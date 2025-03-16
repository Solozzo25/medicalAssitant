// js/api.js

/**
 * Funkcja do wysyłania zapytania do API OpenAI za pośrednictwem netlify function
 * @param {Object} patientData - Dane pacjenta z formularza
 * @returns {Promise<Object>} - Promise z odpowiedzią zawierającą diagnozy
 */
async function getDiagnosis(patientData) {
  try {
    const response = await fetch('/.netlify/functions/gpt-diagnosis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patientData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Błąd serwera: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Błąd podczas pobierania diagnozy:', error);
    throw error;
  }
}

/**
 * Funkcja do wysyłania zapytania do API Perplexity za pośrednictwem netlify function
 * @param {Object} diagnosisData - Dane zawierające diagnozę i towarzystwo medyczne
 * @returns {Promise<Object>} - Promise z odpowiedzią zawierającą rekomendacje leczenia
 */
async function getTreatmentRecommendations(diagnosisData) {
  try {
    // Upewniamy się, że przekazujemy tylko diagnozę i towarzystwo medyczne
    const requestData = {
      diagnosis: diagnosisData.diagnosis,
      medicalSociety: diagnosisData.medicalSociety
    };
    
    const response = await fetch('/.netlify/functions/perplexity-treatment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Błąd serwera: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Błąd podczas pobierania rekomendacji leczenia:', error);
    throw error;
  }
}

/**
 * Funkcja do eksportu wyników do PDF
 * @param {Object} diagnosisData - Dane diagnozy
 * @param {Object} treatmentData - Dane rekomendacji leczenia
 * @param {Object} patientData - Dane pacjenta
 */
function exportToPDF(diagnosisData, treatmentData, patientData) {
  // Tutaj implementacja eksportu do PDF
  // Można użyć biblioteki jak jsPDF czy html2pdf
  alert('Funkcja eksportu do PDF będzie zaimplementowana w przyszłości.');
}
