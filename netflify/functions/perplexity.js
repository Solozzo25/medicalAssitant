// netlify/functions/perplexity.js

exports.handler = async (event) => {
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

  try {
    const { messages } = JSON.parse(event.body);

    // Wyślij zapytanie do Perplexity API
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-7b-instruct", // Możesz zmienić model
        messages: messages,
      }),
    });

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("Błąd w Perplexity API:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Błąd w komunikacji z Perplexity API." }),
    };
  }
};
