// netlify/functions/gpt.js

exports.handler = async (event) => {
  // Pobierz klucz API z ukrytych zmiennych
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  try {
    // Odczytaj zapytanie od użytkownika
    const { messages } = JSON.parse(event.body);

    // Wyślij zapytanie do OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: messages, // Obsługuje pełną historię wiadomości
      }),
    });

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("Błąd backendu:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Coś poszło nie tak!" }),
    };
  }
};
