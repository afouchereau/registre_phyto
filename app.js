// Variables globales
let treatments = [];
let ammList = {};
let establishmentSettings = {
    siretHolder: "",
    siretBeneficiary: ""
};
const AMM_LIST_URL = "https://exemple.fr/amm_list.json"; // À remplacer par une URL officielle si disponible
const LOCAL_AMM_FILE = "assets/amm_list.json";

// Initialisation
document.addEventListener("DOMContentLoaded", async () => {
    await openDB();
    await loadAMMList();
    loadEstablishmentSettings();
    setupEventListeners();
    loadTreatments();
    checkReminder();
    updateLastUpdateDisplay();
    updateLastExportDisplay();
    setupTabs();
});

// Charger les paramètres de l'établissement depuis localStorage
function loadEstablishmentSettings() {
    const savedSettings = localStorage.getItem('establishmentSettings');
    if (savedSettings) {
        establishmentSettings = JSON.parse(savedSettings);
        // Remplir les champs du formulaire dans l'onglet Paramètres
        const siretHolderInput = document.getElementById("siretHolder");
        const siretBeneficiaryInput = document.getElementById("siretBeneficiary");
        if (siretHolderInput) {
            siretHolderInput.value = establishmentSettings.siretHolder || "";
        }
        if (siretBeneficiaryInput) {
            siretBeneficiaryInput.value = establishmentSettings.siretBeneficiary || "";
        }
    }
}

// Enregistrer les paramètres de l'établissement
function saveEstablishmentSettings() {
    const siretHolderInput = document.getElementById("siretHolder");
    const siretBeneficiaryInput = document.getElementById("siretBeneficiary");

    if (!siretHolderInput || !siretBeneficiaryInput) {
        console.error("Les champs SIRET ne sont pas trouvés.");
        return;
    }

    establishmentSettings.siretHolder = siretHolderInput.value;
    establishmentSettings.siretBeneficiary = siretBeneficiaryInput.value || null;

    localStorage.setItem('establishmentSettings', JSON.stringify(establishmentSettings));

    const statusElement = document.getElementById("establishmentStatus");
    if (statusElement) {
        statusElement.textContent = "✅ Paramètres enregistrés !";
        statusElement.style.color = "#2E7D32";
        setTimeout(() => {
            statusElement.textContent = "";
        }, 3000);
    }
}

// Configurer les onglets
function setupTabs() {
    const tabButtons = document.querySelectorAll(".tab-button");
    const tabContents = document.querySelectorAll(".tab-content");

    if (tabButtons.length === 0 || tabContents.length === 0) return;

    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            tabButtons.forEach(btn => btn.classList.remove("active"));
            tabContents.forEach(content => content.classList.remove("active"));

            button.classList.add("active");
            const tabId = button.getAttribute("data-tab");
            const tabContent = document.getElementById(tabId);
            if (tabContent) {
                tabContent.classList.add("active");
            }
        });
    });
}

// Charger la liste des AMM
async function loadAMMList() {
    try {
        const storedList = localStorage.getItem('ammList');
        const storedDate = localStorage.getItem('ammListLastUpdate');

        if (storedList) {
            ammList = JSON.parse(storedList);
            console.log("Liste des AMM chargée depuis localStorage (date: " + storedDate + ").");
        } else {
            try {
                const localResponse = await fetch(LOCAL_AMM_FILE);
                ammList = await localResponse.json();
                console.log("Liste des AMM chargée depuis le fichier local.");
            } catch (localError) {
                console.warn("Impossible de charger le fichier local des AMM:", localError);
                ammList = {};
            }
        }

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
    if (!navigator.onLine) {
        const statusElement = document.getElementById("updateStatus");
        if (statusElement) {
            statusElement.textContent = "⚠️ Vous êtes hors ligne. Impossible de vérifier les mises à jour.";
            statusElement.style.color = "#ff5722";
        }
        return;
    }

    try {
        const statusElement = document.getElementById("updateStatus");
        if (statusElement) {
            statusElement.textContent = "🔍 Vérification des mises à jour en cours...";
            statusElement.style.color = "#1976D2";
        }

        const response = await fetch(AMM_LIST_URL);
        if (!response.ok) {
            throw new Error("Réponse du serveur non valide (code: " + response.status + ")");
        }
        const remoteList = await response.json();

        const currentListStr = JSON.stringify(ammList);
        const remoteListStr = JSON.stringify(remoteList);

        if (currentListStr !== remoteListStr) {
            ammList = remoteList;
            localStorage.setItem('ammList', JSON.stringify(ammList));
            localStorage.setItem('ammListLastUpdate', new Date().toISOString());
            console.log("Liste des AMM mise à jour depuis le serveur.");
            updateLastUpdateDisplay();
            if (statusElement) {
                statusElement.textContent = "✅ Liste des AMM mise à jour !";
                statusElement.style.color = "#2E7D32";
            }
        } else {
            if (statusElement) {
                statusElement.textContent = "✅ Liste des AMM déjà à jour.";
                statusElement.style.color = "#2E7D32";
            }
        }
    } catch (error) {
        console.warn("Impossible de vérifier les mises à jour des AMM:", error);
        const statusElement = document.getElementById("updateStatus");
        if (statusElement) {
            statusElement.textContent = "❌ Impossible de vérifier les mises à jour (erreur serveur).";
            statusElement.style.color = "red";
        }
    }
}

// Mettre à jour l'affichage de la date de dernière mise à jour des AMM
function updateLastUpdateDisplay() {
    const lastUpdate = localStorage.getItem('ammListLastUpdate');
    const displayElement = document.getElementById("lastUpdateDate");
    if (displayElement) {
        if (lastUpdate) {
            displayElement.textContent = new Date(lastUpdate).toLocaleString('fr-FR');
        } else {
            displayElement.textContent = "Jamais";
        }
    }
}

// Mettre à jour l'affichage de la date du dernier export
function updateLastExportDisplay() {
    const lastExport = localStorage.getItem('lastExportDate');
    const displayElement = document.getElementById("lastExportDate");
    if (displayElement) {
        if (lastExport) {
            displayElement.textContent = new Date(lastExport).toLocaleString('fr-FR');
        } else {
            displayElement.textContent = "Jamais";
        }
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
        updateTreatmentCount();
    } catch (error) {
        console.error("Erreur de chargement des traitements:", error);
        treatments = [];
    }
}

// Mettre à jour le compteur de traitements
function updateTreatmentCount() {
    const countElement = document.getElementById("treatmentCount");
    if (countElement) {
        countElement.textContent = treatments.length;
    }
}

// Afficher la liste des traitements (dans l'onglet Exports)
function renderTreatmentList() {
    const listContainer = document.getElementById("listContainer");
    if (!listContainer) return;

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
                <button onclick="editTreatment(${treatment.id})" style="background-color: #1976D2; margin-right: 5px;">✏️</button>
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
    const locationRadios = document.querySelectorAll('input[name="locationType"]');
    if (locationRadios.length > 0) {
        locationRadios.forEach(radio => {
            radio.addEventListener("change", (e) => {
                const rpgFields = document.getElementById("rpgFields");
                const gpsFields = document.getElementById("gpsFields");
                if (rpgFields && gpsFields) {
                    rpgFields.style.display = e.target.value === "rpg" ? "block" : "none";
                    gpsFields.style.display = e.target.value === "gps" ? "block" : "none";
                }
            });
        });
    }

    // Bouton "Obtenir ma position"
    const getGpsButton = document.getElementById("getGps");
    if (getGpsButton) {
        getGpsButton.addEventListener("click", () => {
            if (navigator.geolocation) {
                const statusElement = document.getElementById("updateStatus");
                if (statusElement) {
                    statusElement.textContent = "📍 Récupération de la position en cours...";
                    statusElement.style.color = "#1976D2";
                }
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const gpsCoordsInput = document.getElementById("gpsCoords");
                        if (gpsCoordsInput) {
                            const coords = `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
                            gpsCoordsInput.value = coords;
                        }
                        if (statusElement) {
                            statusElement.textContent = "✅ Position GPS récupérée !";
                            statusElement.style.color = "#2E7D32";
                        }
                    },
                    (error) => {
                        if (statusElement) {
                            statusElement.textContent = "❌ Erreur de géolocalisation: " + error.message;
                            statusElement.style.color = "red";
                        }
                    }
                );
            } else {
                const statusElement = document.getElementById("updateStatus");
                if (statusElement) {
                    statusElement.textContent = "❌ La géolocalisation n'est pas supportée.";
                    statusElement.style.color = "red";
                }
            }
        });
    }

    // Vérification de l'AMM en temps réel
    const ammNumberInput = document.getElementById("ammNumber");
    if (ammNumberInput) {
        ammNumberInput.addEventListener("blur", () => {
            const ammNumber = ammNumberInput.value;
            const warningElement = document.getElementById("ammWarning");
            if (warningElement) {
                if (ammNumber && !isValidAMM(ammNumber)) {
                    warningElement.style.display = "block";
                } else {
                    warningElement.style.display = "none";
                }
            }
        });
    }

    // Soumission du formulaire
    const treatmentForm = document.getElementById("treatmentForm");
    if (treatmentForm) {
        treatmentForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const ammNumberInput = document.getElementById("ammNumber");
            const ammNumber = ammNumberInput ? ammNumberInput.value : "";

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
                siretHolder: establishmentSettings.siretHolder,
                siretBeneficiary: establishmentSettings.siretBeneficiary || null,
                productName: document.getElementById("productName").value,
                ammNumber: document.getElementById("ammNumber").value,
                activeSubstances: document.getElementById("activeSubstances") ? document.getElementById("activeSubstances").value || null : null,
                treatmentDate: document.getElementById("treatmentDate").value,
                locationType: document.querySelector('input[name="locationType"]:checked') ? document.querySelector('input[name="locationType"]:checked').value : "rpg",
                ilot: document.getElementById("ilot") ? document.getElementById("ilot").value || null : null,
                parcelle: document.getElementById("parcelle") ? document.getElementById("parcelle").value || null : null,
                insee: document.getElementById("insee") ? document.getElementById("insee").value || null : null,
                gpsCoords: document.getElementById("gpsCoords") ? document.getElementById("gpsCoords").value || null : null,
                dose: document.getElementById("dose").value,
                doseUnit: document.getElementById("doseUnit").value,
                surface: document.getElementById("surface").value,
                surfaceUnit: document.getElementById("surfaceUnit").value,
                crop: document.getElementById("crop").value,
                phenologicalStage: document.getElementById("phenologicalStage") ? document.getElementById("phenologicalStage").value || null : null,
                isOrganic: document.getElementById("isOrganic").value,
                lotNumber: document.getElementById("lotNumber") ? document.getElementById("lotNumber").value || null : null,
                sowingDensity: document.getElementById("sowingDensity") ? document.getElementById("sowingDensity").value || null : null,
                createdAt: new Date().toISOString()
            };

            // Vérifier que le SIRET détenteur est bien renseigné
            if (!treatment.siretHolder) {
                alert("⚠️ Veuillez renseigner le SIRET de l'établissement dans l'onglet Paramètres avant d'enregistrer un traitement.");
                return;
            }

            try {
                await addTreatment(treatment);
                loadTreatments();
                resetForm();
                const statusElement = document.getElementById("updateStatus");
                if (statusElement) {
                    statusElement.textContent = "✅ Traitement enregistré avec succès !";
                    statusElement.style.color = "#2E7D32";
                }
            } catch (error) {
                console.error("Erreur lors de l'enregistrement:", error);
                alert("Erreur lors de l'enregistrement du traitement.");
            }
        });
    }

    // Enregistrer les paramètres de l'établissement
    const saveEstablishmentButton = document.getElementById("saveEstablishment");
    if (saveEstablishmentButton) {
        saveEstablishmentButton.addEventListener("click", saveEstablishmentSettings);
    }

    // Export CSV
    const exportCsvButton = document.getElementById("exportCsv");
    if (exportCsvButton) {
        exportCsvButton.addEventListener("click", () => {
            exportToCsv();
            localStorage.setItem("lastExportDate", new Date().toISOString());
            updateLastExportDisplay();
        });
    }

    // Export JSON
    const exportJsonButton = document.getElementById("exportJson");
    if (exportJsonButton) {
        exportJsonButton.addEventListener("click", () => {
            exportToJson();
            localStorage.setItem("lastExportDate", new Date().toISOString());
            updateLastExportDisplay();
        });
    }

    // Vérifier les mises à jour des AMM
    const checkAmmsUpdateButton = document.getElementById("checkAmmsUpdate");
    if (checkAmmsUpdateButton) {
        checkAmmsUpdateButton.addEventListener("click", checkForAMMUpdate);
    }

    // Importer un fichier AMM
    const importAmmsFileButton = document.getElementById("importAmmsFile");
    if (importAmmsFileButton) {
        importAmmsFileButton.addEventListener("click", () => {
            const ammFileInput = document.getElementById("ammFileInput");
            if (ammFileInput) {
                ammFileInput.click();
            }
        });
    }

    const ammFileInput = document.getElementById("ammFileInput");
    if (ammFileInput) {
        ammFileInput.addEventListener("change", (e) => {
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
                    const statusElement = document.getElementById("updateStatus");
                    if (statusElement) {
                        statusElement.textContent = "✅ Fichier des AMM importé avec succès !";
                        statusElement.style.color = "#2E7D32";
                    }
                } catch (error) {
                    const statusElement = document.getElementById("updateStatus");
                    if (statusElement) {
                        statusElement.textContent = "❌ Erreur: le fichier n'est pas un JSON valide.";
                        statusElement.style.color = "red";
                    }
                }
            };
            reader.onerror = () => {
                const statusElement = document.getElementById("updateStatus");
                if (statusElement) {
                    statusElement.textContent = "❌ Erreur de lecture du fichier.";
                    statusElement.style.color = "red";
                }
            };
            reader.readAsText(file);
            e.target.value = "";
        });
    }

    // Tester le rappel
    const testReminderButton = document.getElementById("testReminder");
    if (testReminderButton) {
        testReminderButton.addEventListener("click", () => {
            showReminderNotification();
        });
    }

    // Supprimer tous les traitements
    const clearAllButton = document.getElementById("clearAll");
    if (clearAllButton) {
        clearAllButton.addEventListener("click", () => {
            if (confirm("⚠️ Êtes-vous sûr de vouloir supprimer TOUS les traitements ? Cette action est irréversible.")) {
                clearAllTreatments();
            }
        });
    }
}

// Réinitialiser le formulaire
function resetForm() {
    const treatmentForm = document.getElementById("treatmentForm");
    if (treatmentForm) {
        treatmentForm.reset();
    }

    const rpgFields = document.getElementById("rpgFields");
    const gpsFields = document.getElementById("gpsFields");
    if (rpgFields && gpsFields) {
        rpgFields.style.display = "block";
        gpsFields.style.display = "none";
    }

    const ammWarning = document.getElementById("ammWarning");
    if (ammWarning) {
        ammWarning.style.display = "none";
    }

    const updateStatus = document.getElementById("updateStatus");
    if (updateStatus) {
        updateStatus.textContent = "";
    }

    // Réinitialiser le bouton de soumission
    const submitButton = document.getElementById("submitTreatment");
    if (submitButton) {
        submitButton.textContent = "✅ Enregistrer le traitement";
    }
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
        t.siretHolder || "",
        t.siretBeneficiary || "",
        t.productName || "",
        t.ammNumber || "",
        t.activeSubstances || "",
        formatDate(t.treatmentDate) || "",
        t.locationType || "",
        t.ilot || "",
        t.parcelle || "",
        t.insee || "",
        t.gpsCoords || "",
        t.dose || "",
        t.doseUnit || "",
        t.surface || "",
        t.surfaceUnit || "",
        t.crop || "",
        t.phenologicalStage || "",
        t.isOrganic || "",
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
            const statusElement = document.getElementById("updateStatus");
            if (statusElement) {
                statusElement.textContent = "✅ Traitement supprimé.";
                statusElement.style.color = "#2E7D32";
            }
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

    // Basculer vers l'onglet Déclaration
    const tabButtons = document.querySelectorAll(".tab-button");
    const tabContents = document.querySelectorAll(".tab-content");
    tabButtons.forEach(btn => btn.classList.remove("active"));
    tabContents.forEach(content => content.classList.remove("active"));
    const declarationTabButton = document.querySelector(".tab-button[data-tab='declaration']");
    const declarationTabContent = document.getElementById("declaration");
    if (declarationTabButton && declarationTabContent) {
        declarationTabButton.classList.add("active");
        declarationTabContent.classList.add("active");
    }

    // Remplir le formulaire
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
    const submitButton = document.getElementById("submitTreatment");
    if (submitButton) {
        submitButton.textContent = "🔄 Mettre à jour le traitement";
    }

    document.getElementById("treatmentForm").onsubmit = async (e) => {
        e.preventDefault();
        const updatedTreatment = {
            siretHolder: establishmentSettings.siretHolder,
            siretBeneficiary: establishmentSettings.siretBeneficiary || null,
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
            const statusElement = document.getElementById("updateStatus");
            if (statusElement) {
                statusElement.textContent = "✅ Traitement mis à jour !";
                statusElement.style.color = "#2E7D32";
            }
        } catch (error) {
            console.error("Erreur de mise à jour:", error);
            alert("Erreur lors de la mise à jour du traitement.");
        }
    };
}

// Supprimer tous les traitements
async function clearAllTreatments() {
    try {
        await openDB();
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
            treatments = [];
            renderTreatmentList();
            updateTreatmentCount();
            const statusElement = document.getElementById("updateStatus");
            if (statusElement) {
                statusElement.textContent = "✅ Tous les traitements ont été supprimés.";
                statusElement.style.color = "#2E7D32";
            }
        };

        request.onerror = () => {
            console.error("Erreur lors de la suppression de tous les traitements:", request.error);
            alert("Erreur lors de la suppression des traitements.");
        };
    } catch (error) {
        console.error("Erreur lors de l'ouverture de la base de données:", error);
        alert("Erreur lors de la suppression des traitements.");
    }
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
