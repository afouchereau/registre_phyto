// Initialisation de IndexedDB
const DB_NAME = "PhytoRegisterDB";
const STORE_NAME = "treatments";

let db;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            reject("Erreur d'ouverture de la base de données: " + event.target.error);
        };
    });
}

// Ajouter un traitement
async function addTreatment(treatment) {
    await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(treatment);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject("Erreur lors de l'ajout: " + request.error);
    });
}

// Récupérer tous les traitements
async function getAllTreatments() {
    await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject("Erreur lors de la récupération: " + request.error);
    });
}

// Supprimer un traitement
async function deleteTreatment(id) {
    await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject("Erreur lors de la suppression: " + request.error);
    });
}

// Mettre à jour un traitement
async function updateTreatment(id, updates) {
    await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            const treatment = request.result;
            Object.assign(treatment, updates);
            const updateRequest = store.put(treatment);

            updateRequest.onsuccess = () => resolve();
            updateRequest.onerror = () => reject("Erreur lors de la mise à jour: " + updateRequest.error);
        };

        request.onerror = () => reject("Erreur lors de la récupération du traitement: " + request.error);
    });
}
