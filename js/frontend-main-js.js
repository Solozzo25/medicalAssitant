// js/main.js

document.addEventListener('DOMContentLoaded', function() {
  // Elementy UI
  const diagnosisForm = document.getElementById('diagnosis-form');
  const resultsSection = document.getElementById('results');
  const loadingIndicator = document.querySelector('.loading');
  const exportButton = document.querySelector('button.btn-secondary');
  
  // Globalne obiekty do przechowywania danych
  let currentDiagnosisData = null;
  let currentTreatmentData = null;
  let currentPatientData = null;
  
  // Funkcja do przełączania zakładek
  function setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        // Usuń klasę active ze wszystkich zakładek i zawartości
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // Dodaj klasę active do klikniętej zakładki
        tab.classList.add('active');
        
        // Pokaż odpowiednią zawartość
        const tabName = tab.getAttribute('data-tab');
        document.getElementById(tabName).classList.add('active');
      });
    });
  }
  
  // Funkcja do obsługi formularza
  function setupForm() {
    diagnosisForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Pokaż loading spinner
      loadingIndicator.style.display = 'block';
      
      // Zbierz dane z formularza
      const formData = {
        age: document.getElementById('age').value,
        sex: document.getElementById('gender').value,
        symptoms: document.getElementById('symptoms').value,
        physicalExam: document.getElementById('physical').value,
        additionalTests: document.getElementById('labs').value,
        medicalHistory: document.getElementById('history').value
      };
      
      // Zachowaj dane pacjenta
      currentPatientData = formData;
      
      try {
        // Pobierz diagnozę
        const diagnosisResponse = await getDiagnosis(formData);
        currentDiagnosisData = diagnosisResponse;
        
        // Pokaż wyniki diagnozy
        displayDiagnosisResults(diagnosisResponse);
        
        // Pobierz rekomendacje leczenia - przekazujemy tylko diagnozę i towarzystwo medyczne
        const treatmentRequestData = {
          diagnosis: diagnosisResponse.Diagnoza_Główna,
          medicalSociety: diagnosisResponse.Towarzystwo_Medyczne
        };
        
        const treatmentResponse = await getTreatmentRecommendations(treatmentRequestData);
        currentTreatmentData = treatmentResponse;
        
        // Pokaż wyniki leczenia
        displayTreatmentResults(treatmentResponse);
        
        // Przejdź do zakładki wyników
        document.querySelector('[data-tab="results"]').click();
      } catch (error) {
        console.error('Błąd:', error);
        showError(error.message || 'Wystąpił nieoczekiwany błąd podczas przetwarzania zapytania.');
      } finally {
        // Ukryj loading spinner
        loadingIndicator.style.display = 'none';
      }
    });
  }
  
  // Funkcja do wyświetlania diagnozy
  function displayDiagnosisResults(data) {
    // Sekcja diagnozy głównej
    const mainDiagnosisSection = document.querySelector('.result-card.diagnosis');
    mainDiagnosisSection.innerHTML = `
      <h3 class="result-card-title">
        <i>🔍</i> Diagnoza główna
      </h3>
      <div class="result-item">
        <h4 class="result-item-title">
          ${data.Diagnoza_Główna} <span class="confidence high">Główna diagnoza</span>
        </h4>
        <p class="result-item-description">
          <strong>Uzasadnienie:</strong> ${data.Uzasadnienie_Diagnozy}
        </p>
      </div>
    `;
    
    // Sekcja diagnozy różnicowej
    const differentialSection = document.querySelector('.result-card.differential');
    differentialSection.innerHTML = `
      <h3 class="result-card-title">
        <i>🧩</i> Diagnostyka różnicowa
      </h3>
      <div class="result-item">
        <h4 class="result-item-title">
          ${data.Diagnoza_Różnicowa} <span class="confidence medium">Diagnoza różnicowa</span>
        </h4>
        <p class="result-item-description">
          <strong>Uzasadnienie:</strong> ${data.Uzasadnienie_Różnicowe}
        </p>
      </div>
    `;
    
    // Dodaj informację o towarzystwie medycznym
    differentialSection.innerHTML += `
      <div class="result-item" style="margin-top: 20px; border-top: 1px dashed var(--tertiary-color); padding-top: 15px;">
        <h4 class="result-item-title">Rekomendowane wytyczne</h4>
        <p class="result-item-description">
          <strong>${data.Towarzystwo_Medyczne}</strong>
        </p>
      </div>
    `;
  }
  
  // Funkcja do wyświetlania rekomendacji leczenia
  function displayTreatmentResults(data) {
    // Sekcja leczenia
    const treatmentSection = document.querySelector('.result-card.treatment');
    treatmentSection.innerHTML = `
      <h3 class="result-card-title">
        <i>💊</i> Leczenie
      </h3>
      <div class="result-item">
        <h4 class="result-item-title">Farmakoterapia</h4>
        <ul>
          ${Array.isArray(data.Farmakoterapia) 
            ? data.Farmakoterapia.map(item => `<li>${item}</li>`).join('')
            : `<li>${data.Farmakoterapia}</li>`}
        </ul>
      </div>
      <div class="result-item">
        <h4 class="result-item-title">Zalecenia niefarmakologiczne</h4>
        <ul>
          ${Array.isArray(data.Zalecenia_Niefarmakologiczne) 
            ? data.Zalecenia_Niefarmakologiczne.map(item => `<li>${item}</li>`).join('')
            : `<li>${data.Zalecenia_Niefarmakologiczne}</li>`}
        </ul>
      </div>
    `;
    
    // Sekcja charakterystyki leku
    const drugSection = document.querySelector('.result-card:last-of-type');
    const drug = data.Charakterystyka_Leku;
    
    drugSection.innerHTML = `
      <h3 class="result-card-title">
        <i>📋</i> Charakterystyka leku
      </h3>
      <div class="result-item">
        <h4 class="result-item-title">${drug.Nazwa}</h4>
        <ul>
          <li><strong>Wskazania:</strong> 
            ${Array.isArray(drug.Wskazania) 
              ? drug.Wskazania.join(', ')
              : drug.Wskazania}
          </li>
          <li><strong>Przeciwwskazania:</strong> 
            ${Array.isArray(drug.Przeciwwskazania) 
              ? drug.Przeciwwskazania.join(', ')
              : drug.Przeciwwskazania}
          </li>
          <li><strong>Interakcje:</strong> 
            ${Array.isArray(drug.Interakcje) 
              ? drug.Interakcje.join(', ')
              : drug.Interakcje}
          </li>
        </ul>
      </div>
    `;
  }
  
  // Funkcja do wyświetlania błędów
  function showError(message) {
    // Utwórz element z komunikatem błędu
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
    errorDiv.style.color = 'var(--error)';
    errorDiv.style.padding = '1rem';
    errorDiv.style.borderRadius = '0.5rem';
    errorDiv.style.marginBottom = '1rem';
    errorDiv.style.fontWeight = '500';
    errorDiv.style.textAlign = 'center';
    errorDiv.textContent = message;
    
    // Dodaj na górze sekcji wyników
    const resultSection = document.querySelector('.result-section');
    resultSection.prepend(errorDiv);
    
    // Ukryj po 10 sekundach
    setTimeout(() => {
      errorDiv.style.opacity = '0';
      errorDiv.style.transition = 'opacity 0.5s ease';
      setTimeout(() => errorDiv.remove(), 500);
    }, 10000);
  }
  
  // Funkcja do obsługi eksportu do PDF
  function setupExportButton() {
    exportButton.addEventListener('click', () => {
      if (currentDiagnosisData && currentTreatmentData && currentPatientData) {
        exportToPDF(currentDiagnosisData, currentTreatmentData, currentPatientData);
      } else {
        alert('Brak danych do eksportu. Najpierw uzyskaj diagnozę i rekomendacje leczenia.');
      }
    });
  }
  
  // Inicjalizacja
  setupTabs();
  setupForm();
  setupExportButton();
});
