// Variables globales
let treatments = [];
let ammList = {};
const AMM_LIST_URL = "https://exemple.fr/amm_list.json"; // À remplacer par une URL officielle si disponible
const LOCAL_AMM_FILE = "assets/amm_list.json";

// Initialisation
document.addEventListener("DOMContentLoaded", async () => {
    await openDB();
    await loadAMMList();
    setupEventListeners();
    loadTreatments();
    checkReminder();
    updateLastUpdateDisplay();
});

// Charger la liste des AMM
async function loadAMMList() {
    try {
        // 1. Vérifier localStorage
        const storedList = localStorage.getItem('ammList');
        const storedDate = localStorage.getItem('ammListLastUpdate');

        if (storedList) {
            ammList = JSON.parse(storedList);
            console.log("Liste des AMM chargée depuis localStorage (date: " + storedDate + ").");
        } else {
            // 2. Charger le fichier local par défaut
            try {
                const localResponse = await fetch(LOCAL_AMM_FILE);
                ammList = await localResponse.json();
                console.log("Liste des AMM chargée depuis le fichier local.");
            } catch (localError) {
                console.warn("Impossible de charger le fichier local des AMM:", localError);
                ammList = {};
            }
        }

        // 3. Vérifier les mises à jour si en ligne
        if (navigator.onLine) {
            await checkForAMMUpdate();
        }
    } catch (error) {
        console.error("Erreur initiale de chargement des AMM:", error);
        ammList = {};
    }
}

// Vérifier les mises à jour des AMM
async function checkForAMMUpdate() {
    if (!navigator.onLine) return;

    try {
        const response = await fetch(AMM_LIST_URL);
        if (!response.ok) {
            throw new Error("Réponse du serveur non valide (code: " + response.status + ")");
        }
        const remoteList = await response.json();

        // Comparer avec la liste actuelle
        const currentListStr = JSON.stringify(ammList);
        const remoteListStr = JSON.stringify(remoteList);

        if (currentListStr !== remoteListStr) {
            ammList = remoteList;
            localStorage.setItem('ammList', JSON.stringify(ammList));
            localStorage.setItem('ammListLastUpdate', new Date().toISOString());
            console.log("Liste des AMM mise à jour depuis le serveur.");
            updateLastUpdateDisplay();
            document.getElementById("updateStatus").textContent = "✅ Liste des AMM mise à jour !";
            document.getElementById("updateStatus").style.color = "#2E7D32";
        } else {
            document.getElementById("updateStatus").textContent = "✅ Liste des AMM déjà à jour.";
            document.getElementById("updateStatus").style.color = "#2E7D32";
        }
    } catch (error) {
        console.warn("Impossible de vérifier les mises à jour des AMM:", error);
        document.getElementById("updateStatus").textContent = "⚠️ Impossible de vérifier les mises à jour (hors ligne ou erreur).";
        document.getElementById("updateStatus").style.color = "#ff5722";
    }
}

// Mettre à jour l'affichage de la date de dernière mise à jour
function updateLastUpdateDisplay() {
    const lastUpdate = localStorage.getItem('ammListLastUpdate');
    const displayElement = document.getElementById("lastUpdateDate");
    if (lastUpdate) {
        displayElement.textContent = new Date(lastUpdate).toLocaleString('fr-FR');
    } else {
        displayElement.textContent = "Jamais";
    }
}

// Vérifier si un numéro AMM est valide
function isValidAMM(ammNumber) {
    return ammList.hasOwnProperty(ammNumber);
}

// Charger les traitements depuis IndexedDB
async function loadTreatments() {
    try {
        treatments = await getAllTreatments();
        renderTreatmentList();
    } catch (error) {
        console.error("Erreur de chargement des traitements:", error);
        treatments = [];
    }
}

// Afficher la liste des traitements
function renderTreatmentList() {
    const listContainer = document.getElementById("listContainer");
    listContainer.innerHTML = "";

    if (treatments.length === 0) {
        listContainer.innerHTML = "<p>Aucun traitement enregistré.</p>";
        return;
    }

    const table = document.createElement("table");
    table.innerHTML = `
        <thead>
            <tr>
                <th>Date</th>
                <th>Produit (AMM)</th>
                <th>Culture</th>
                <th>Surface</th>
                <th>Dose</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    treatments.forEach(treatment => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${formatDate(treatment.treatmentDate)}</td>
            <td>${treatment.productName} (${treatment.ammNumber})</td>
            <td>${treatment.crop}</td>
            <td>${treatment.surface} ${treatment.surfaceUnit}</td>
            <td>${treatment.dose} ${treatment.doseUnit}</td>
            <td>
                <button onclick="editTreatment(${treatment.id})" style="background-color: #1976D2;">✏️</button>
                <button onclick="confirmDelete(${treatment.id})" style="background-color: #D32F2F;">🗑️</button>
            </td>
        `;
        table.querySelector("tbody").appendChild(row);
    });

    listContainer.appendChild(table);
}

// Formater une date (YYYY-MM-DD -> DD/MM/YYYY)
function formatDate(dateStr) {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

// Gestion du formulaire
function setupEventListeners() {
    // Basculer entre RPG et GPS
    document.querySelectorAll('input[name="locationType"]').forEach(radio => {
        radio.addEventListener("change", (e) => {
            document.getElementById("rpgFields").style.display = e.target.value === "rpg" ? "block" : "none";
            document.getElementById("gpsFields").style.display = e.target.value === "gps" ? "block" : "none";
        });
    });

    // Bouton "Obtenir ma position"
    document.getElementById("getGps").addEventListener("click", () => {
        if (navigator.geolocation) {
            document.getElementById("updateStatus").textContent = "📍 Récupération de la position en cours...";
            document.getElementById("updateStatus").style.color = "#1976D2";
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const coords = `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
                    document.getElementById("gpsCoords").value = coords;
                    document.getElementById("updateStatus").textContent = "✅ Position GPS récupérée !";
                    document.getElementById("updateStatus").style.color = "#2E7D32";
                },
                (error) => {
                    document.getElementById("updateStatus").textContent = "❌ Erreur de géolocalisation: " + error.message;
                    document.getElementById("updateStatus").style.color = "red";
                }
            );
        } else {
            document.getElementById("updateStatus").textContent = "❌ La géolocalisation n'est pas supportée.";
            document.getElementById("updateStatus").style.color = "red";
        }
    });

    // Vérification de l'AMM en temps réel
    document.getElementById("ammNumber").addEventListener("blur", () => {
        const ammNumber = document.getElementById("ammNumber").value;
        const warningElement = document.getElementById("ammWarning");
        if (ammNumber && !isValidAMM(ammNumber)) {
            warningElement.style.display = "block";
        } else {
            warningElement.style.display = "none";
        }
    });

    // Soumission du formulaire
    document.getElementById("treatmentForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const ammNumber = document.getElementById("ammNumber").value;

        if (ammNumber && !isValidAMM(ammNumber)) {
            const confirmAnyway = confirm(
                "⚠️ Le numéro AMM saisi n'est pas dans la liste locale. " +
                "Vérifiez-le ou mettez à jour la liste des AMM. " +
                "Souhaitez-vous enregistrer quand même ?"
            );
            if (!confirmAnyway) {
                return;
            }
        }

        const treatment = {
            siretHolder: document.getElementById("siretHolder").value,
            siretBeneficiary: document.getElementById("siretBeneficiary").value || null,
            productName: document.getElementById("productName").value,
            ammNumber: document.getElementById("ammNumber").value,
            activeSubstances: document.getElementById("activeSubstances").value || null,
            treatmentDate: document.getElementById("treatmentDate").value,
            locationType: document.querySelector('input[name="locationType"]:checked').value,
            ilot: document.getElementById("ilot").value || null,
            parcelle: document.getElementById("parcelle").value || null,
            insee: document.getElementById("insee").value || null,
            gpsCoords: document.getElementById("gpsCoords").value || null,
            dose: document.getElementById("dose").value,
            doseUnit: document.getElementById("doseUnit").value,
            surface: document.getElementById("surface").value,
            surfaceUnit: document.getElementById("surfaceUnit").value,
            crop: document.getElementById("crop").value,
            phenologicalStage: document.getElementById("phenologicalStage").value || null,
            isOrganic: document.getElementById("isOrganic").value,
            lotNumber: document.getElementById("lotNumber").value || null,
            sowingDensity: document.getElementById("sowingDensity").value || null,
            createdAt: new Date().toISOString()
        };

        try {
            await addTreatment(treatment);
            loadTreatments();
            resetForm();
            document.getElementById("updateStatus").textContent = "✅ Traitement enregistré avec succès !";
            document.getElementById("updateStatus").style.color = "#2E7D32";
        } catch (error) {
            console.error("Erreur lors de l'enregistrement:", error);
            alert("Erreur lors de l'enregistrement du traitement.");
        }
    });

    // Export CSV
    document.getElementById("exportCsv").addEventListener("click", () => {
        exportToCsv();
    });

    // Export JSON
    document.getElementById("exportJson").addEventListener("click", () => {
        exportToJson();
    });

    // Vérifier les mises à jour des AMM
    document.getElementById("checkAmmsUpdate").addEventListener("click", async () => {
        document.getElementById("updateStatus").textContent = "🔍 Vérification des mises à jour en cours...";
        document.getElementById("updateStatus").style.color = "#1976D2";
        await checkForAMMUpdate();
    });

    // Importer un fichier AMM
    document.getElementById("importAmmsFile").addEventListener("click", () => {
        document.getElementById("ammFileInput").click();
    });

    document.getElementById("ammFileInput").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const newList = JSON.parse(e.target.result);
                ammList = newList;
                localStorage.setItem('ammList', JSON.stringify(ammList));
                localStorage.setItem('ammListLastUpdate', new Date().toISOString());
                updateLastUpdateDisplay();
                document.getElementById("updateStatus").textContent = "✅ Fichier des AMM importé avec succès !";
                document.getElementById("updateStatus").style.color = "#2E7D32";
            } catch (error) {
                document.getElementById("updateStatus").textContent = "❌ Erreur: le fichier n'est pas un JSON valide.";
                document.getElementById("updateStatus").style.color = "red";
            }
        };
        reader.onerror = () => {
            document.getElementById("updateStatus").textContent = "❌ Erreur de lecture du fichier.";
            document.getElementById("updateStatus").style.color = "red";
        };
        reader.readAsText(file);
        e.target.value = ""; // Réinitialiser l'input file
    });
}

// Réinitialiser le formulaire
function resetForm() {
    document.getElementById("treatmentForm").reset();
    document.getElementById("rpgFields").style.display = "block";
    document.getElementById("gpsFields").style.display = "none";
    document.getElementById("ammWarning").style.display = "none";
    document.getElementById("updateStatus").textContent = "";
}

// Exporter en CSV
function exportToCsv() {
    if (treatments.length === 0) {
        alert("Aucun traitement à exporter.");
        return;
    }

    const headers = [
        "SIRET Détenteur", "SIRET Bénéficiaire", "Nom Produit", "Numéro AMM",
        "Substances actives", "Date", "Type Localisation", "Îlot", "Parcelle",
        "Code INSEE", "Coordonnées GPS", "Dose", "Unité Dose", "Surface",
        "Unité Surface", "Culture", "Stade Phénologique", "Bio ?", "Numéro Lot",
        "Densité Semis", "Date Création"
    ];

    const rows = treatments.map(t => [
        t.siretHolder,
        t.siretBeneficiary || "",
        t.productName,
        t.ammNumber,
        t.activeSubstances || "",
        formatDate(t.treatmentDate),
        t.locationType,
        t.ilot || "",
        t.parcelle || "",
        t.insee || "",
        t.gpsCoords || "",
        t.dose,
        t.doseUnit,
        t.surface,
        t.surfaceUnit,
        t.crop,
        t.phenologicalStage || "",
        t.isOrganic,
        t.lotNumber || "",
        t.sowingDensity || "",
        new Date(t.createdAt).toLocaleString('fr-FR')
    ]);

    const csvContent = [
        headers.join(";"),
        ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(";"))
    ].join("\n");

    downloadFile(csvContent, `registre_phytosanitaire_${new Date().toISOString().split('T')[0]}.csv`, "text/csv");
}

// Exporter en JSON
function exportToJson() {
    if (treatments.length === 0) {
        alert("Aucun traitement à exporter.");
        return;
    }

    const jsonContent = JSON.stringify(treatments, null, 2);
    downloadFile(jsonContent, `registre_phytosanitaire_${new Date().toISOString().split('T')[0]}.json`, "application/json");
}

// Télécharger un fichier
function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Supprimer un traitement (avec confirmation)
function confirmDelete(id) {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce traitement ?")) {
        deleteTreatment(id).then(() => {
            loadTreatments();
            document.getElementById("updateStatus").textContent = "✅ Traitement supprimé.";
            document.getElementById("updateStatus").style.color = "#2E7D32";
        }).catch(error => {
            console.error("Erreur de suppression:", error);
            alert("Erreur lors de la suppression du traitement.");
        });
    }
}

// Éditer un traitement
async function editTreatment(id) {
    const treatment = treatments.find(t => t.id === id);
    if (!treatment) return;

    // Remplir le formulaire avec les données du traitement
    document.getElementById("siretHolder").value = treatment.siretHolder || "";
    document.getElementById("siretBeneficiary").value = treatment.siretBeneficiary || "";
    document.getElementById("productName").value = treatment.productName || "";
    document.getElementById("ammNumber").value = treatment.ammNumber || "";
    document.getElementById("activeSubstances").value = treatment.activeSubstances || "";

    document.getElementById("treatmentDate").value = treatment.treatmentDate || "";

    // Localisation
    if (treatment.locationType === "rpg") {
        document.querySelector('input[name="locationType"][value="rpg"]').checked = true;
        document.getElementById("rpgFields").style.display = "block";
        document.getElementById("gpsFields").style.display = "none";
        document.getElementById("ilot").value = treatment.ilot || "";
        document.getElementById("parcelle").value = treatment.parcelle || "";
        document.getElementById("insee").value = treatment.insee || "";
    } else {
        document.querySelector('input[name="locationType"][value="gps"]').checked = true;
        document.getElementById("rpgFields").style.display = "none";
        document.getElementById("gpsFields").style.display = "block";
        document.getElementById("gpsCoords").value = treatment.gpsCoords || "";
    }

    document.getElementById("dose").value = treatment.dose || "";
    document.getElementById("doseUnit").value = treatment.doseUnit || "kg/ha";
    document.getElementById("surface").value = treatment.surface || "";
    document.getElementById("surfaceUnit").value = treatment.surfaceUnit || "ha";
    document.getElementById("crop").value = treatment.crop || "";
    document.getElementById("phenologicalStage").value = treatment.phenologicalStage || "";
    document.getElementById("isOrganic").value = treatment.isOrganic || "non";
    document.getElementById("lotNumber").value = treatment.lotNumber || "";
    document.getElementById("sowingDensity").value = treatment.sowingDensity || "";

    // Changer le bouton de soumission pour mettre à jour
    const submitButton = document.querySelector("#treatmentForm button[type='submit']");
    submitButton.textContent = "🔄 Mettre à jour le traitement";
    submitButton.onclick = async (e) => {
        e.preventDefault();
        const updatedTreatment = {
            siretHolder: document.getElementById("siretHolder").value,
            siretBeneficiary: document.getElementById("siretBeneficiary").value || null,
            productName: document.getElementById("productName").value,
            ammNumber: document.getElementById("ammNumber").value,
            activeSubstances: document.getElementById("activeSubstances").value || null,
            treatmentDate: document.getElementById("treatmentDate").value,
            locationType: document.querySelector('input[name="locationType"]:checked').value,
            ilot: document.getElementById("ilot").value || null,
            parcelle: document.getElementById("parcelle").value || null,
            insee: document.getElementById("insee").value || null,
            gpsCoords: document.getElementById("gpsCoords").value || null,
            dose: document.getElementById("dose").value,
            doseUnit: document.getElementById("doseUnit").value,
            surface: document.getElementById("surface").value,
            surfaceUnit: document.getElementById("surfaceUnit").value,
            crop: document.getElementById("crop").value,
            phenologicalStage: document.getElementById("phenologicalStage").value || null,
            isOrganic: document.getElementById("isOrganic").value,
            lotNumber: document.getElementById("lotNumber").value || null,
            sowingDensity: document.getElementById("sowingDensity").value || null,
            createdAt: treatment.createdAt,
            updatedAt: new Date().toISOString()
        };

        try {
            await updateTreatment(id, updatedTreatment);
            loadTreatments();
            resetForm();
            submitButton.textContent = "✅ Enregistrer le traitement";
            submitButton.onclick = null;
            document.getElementById("treatmentForm").onsubmit = null;
            document.getElementById("updateStatus").textContent = "✅ Traitement mis à jour !";
            document.getElementById("updateStatus").style.color = "#2E7D32";
        } catch (error) {
            console.error("Erreur de mise à jour:", error);
            alert("Erreur lors de la mise à jour du traitement.");
        }
    };
}

// Rappel tous les 30 jours
function checkReminder() {
    const lastExport = localStorage.getItem("lastExportDate");
    const today = new Date();

    if (!lastExport) {
        localStorage.setItem("lastExportDate", today.toISOString());
        setReminder();
    } else {
        const lastExportDate = new Date(lastExport);
        const daysSinceLastExport = (today - lastExportDate) / (1000 * 60 * 60 * 24);

        if (daysSinceLastExport >= 30) {
            showReminderNotification();
            localStorage.setItem("lastExportDate", today.toISOString());
            setReminder();
        }
    }
}

// Configurer le rappel
function setReminder() {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const timeUntilMidnight = midnight - now;

    setTimeout(() => {
        checkReminder();
        setInterval(checkReminder, 24 * 60 * 60 * 1000);
    }, timeUntilMidnight);
}

// Afficher une notification de rappel
function showReminderNotification() {
    if (!("Notification" in window)) {
        alert("⚠️ Rappel : Pensez à exporter vos données pour la déclaration (obligation légale tous les 30 jours).");
        return;
    }

    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            new Notification("📅 Rappel Phytosanitaire", {
                body: "Pensez à exporter vos données pour la déclaration (obligation légale tous les 30 jours).",
                icon: "assets/icons/icon-192x192.png"
            });
        } else {
            alert("⚠️ Rappel : Pensez à exporter vos données pour la déclaration (obligation légale tous les 30 jours).");
        }
    });
}
