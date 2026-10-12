// Variables globales
let treatments = [];
let ammList = {};
let establishmentSettings = {
    siretHolder: "",
    siretBeneficiary: ""
};
const AMM_LIST_URL = "https://exemple.fr/amm_list.json"; // À remplacer par une URL officielle
const LOCAL_AMM_FILE = "assets/amm_list.json";

// Initialisation
document.addEventListener("DOMContentLoaded", async () => {
    await openDB();
    await loadAMMList();
    loadEstablishmentSettings(); // Charger les paramètres de l'établissement
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
        document.getElementById("siretHolder").value = establishmentSettings.siretHolder || "";
        document.getElementById("siretBeneficiary").value = establishmentSettings.siretBeneficiary || "";
    }
}

// Enregistrer les paramètres de l'établissement
function saveEstablishmentSettings() {
    establishmentSettings.siretHolder = document.getElementById("siretHolder").value;
    establishmentSettings.siretBeneficiary = document.getElementById("siretBeneficiary").value || null;

    localStorage.setItem('establishmentSettings', JSON.stringify(establishmentSettings));
    document.getElementById("establishmentStatus").textContent = "✅ Paramètres enregistrés !";
    document.getElementById("establishmentStatus").style.color = "#2E7D32";
    setTimeout(() => {
        document.getElementById("establishmentStatus").textContent = "";
    }, 3000);
}

// Configurer les onglets
function setupTabs() {
    const tabButtons = document.querySelectorAll(".tab-button");
    const tabContents = document.querySelectorAll(".tab-content");

    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            tabButtons.forEach(btn => btn.classList.remove("active"));
            tabContents.forEach(content => content.classList.remove("active"));

            button.classList.add("active");
            const tabId = button.getAttribute("data-tab");
            document.getElementById(tabId).classList.add("active");
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

// ... (le reste des fonctions reste inchangé jusqu'à setupEventListeners)

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
            siretHolder: establishmentSettings.siretHolder, // Utiliser le SIRET enregistré dans les paramètres
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
            document.getElementById("updateStatus").textContent = "✅ Traitement enregistré avec succès !";
            document.getElementById("updateStatus").style.color = "#2E7D32";
        } catch (error) {
            console.error("Erreur lors de l'enregistrement:", error);
            alert("Erreur lors de l'enregistrement du traitement.");
        }
    });

    // Enregistrer les paramètres de l'établissement
    document.getElementById("saveEstablishment").addEventListener("click", saveEstablishmentSettings);

    // Export CSV
    document.getElementById("exportCsv").addEventListener("click", () => {
        exportToCsv();
        localStorage.setItem("lastExportDate", new Date().toISOString());
        updateLastExportDisplay();
    });

    // Export JSON
    document.getElementById("exportJson").addEventListener("click", () => {
        exportToJson();
        localStorage.setItem("lastExportDate", new Date().toISOString());
        updateLastExportDisplay();
    });

    // Vérifier les mises à jour des AMM
    document.getElementById("checkAmmsUpdate").addEventListener("click", checkForAMMUpdate);

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
        e.target.value = "";
    });

    // Tester le rappel
    document.getElementById("testReminder").addEventListener("click", () => {
        showReminderNotification();
    });

    // Supprimer tous les traitements
    document.getElementById("clearAll").addEventListener("click", () => {
        if (confirm("⚠️ Êtes-vous sûr de vouloir supprimer TOUS les traitements ? Cette action est irréversible.")) {
            clearAllTreatments();
        }
    });
}

// Réinitialiser le formulaire
function resetForm() {
    document.getElementById("treatmentForm").reset();
    document.getElementById("rpgFields").style.display = "block";
    document.getElementById("gpsFields").style.display = "none";
    document.getElementById("ammWarning").style.display = "none";
    document.getElementById("updateStatus").textContent = "";

    // Réinitialiser le bouton de soumission
    const submitButton = document.getElementById("submitTreatment");
    submitButton.textContent = "✅ Enregistrer le traitement";
    submitButton.onclick = null;
    document.getElementById("treatmentForm").onsubmit = null;
}

// ... (le reste du code reste inchangé)
