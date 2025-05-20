import 'dotenv/config'
import Fastify from 'fastify'
import { submitForReview } from './submission.js'

const recipesByCity = {}; // { cityId: [ {id, content}, ... ] }
let nextRecipeId = 1;

const fastify = Fastify({
  logger: true,
});

// ✅ Ta route GET : définie **avant** fastify.listen
fastify.get('/cities/:cityId/infos', async (request, reply) => {
  const { cityId } = request.params;
  const apiKey = process.env.API_KEY;

  try {
    const cityResponse = await fetch(`https://api-ugi2pflmha-ew.a.run.app/cities/${cityId}/insights?apiKey=${apiKey}`);

    if (!cityResponse.ok) {
      return reply.code(404).send({ error: 'City not found' });
    }

    const cityData = await cityResponse.json();

    const coord = cityData.coordinates[0];
    const coordinates = [coord.latitude, coord.longitude];
    const population = cityData.population;
    const knownFor = cityData.knownFor.map(item => item.content);

    const weatherResponse = await fetch(`https://api-ugi2pflmha-ew.a.run.app/weather-predictions?cityIdentifier=${cityId}&apiKey=${apiKey}`);
    const weatherData = await weatherResponse.json();
    const predictions = weatherData[0]?.predictions || [];

    const weatherPredictions = [
      { when: 'today', min: predictions[0]?.minTemperature ?? 0, max: predictions[0]?.maxTemperature ?? 0 },
      { when: 'tomorrow', min: predictions[1]?.minTemperature ?? 0, max: predictions[1]?.maxTemperature ?? 0 }
    ];

    const recipes = recipesByCity[cityId] || [];

    return {
      coordinates,
      population,
      knownFor,
      weatherPredictions,
      recipes
    };

  } catch (err) {
    console.error(err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});
// POST /cities/:cityId/recipes
fastify.post('/cities/:cityId/recipes', async (request, reply) => {
  const { cityId } = request.params;
  const { content } = request.body;
  const apiKey = process.env.API_KEY;

  try {
    // 1. Vérifie si la ville existe dans City API
    const cityResponse = await fetch(`https://api-ugi2pflmha-ew.a.run.app/cities/${cityId}/insights?apiKey=${apiKey}`);
    if (!cityResponse.ok) {
      return reply.code(404).send({ error: 'City not found' });
    }

    // 2. Validation du champ content
    if (!content || typeof content !== 'string') {
      return reply.code(400).send({ error: 'Content is required' });
    }
    if (content.length < 10) {
      return reply.code(400).send({ error: 'Content too short (min 10 chars)' });
    }
    if (content.length > 2000) {
      return reply.code(400).send({ error: 'Content too long (max 2000 chars)' });
    }

    // 3. Crée une nouvelle recette
    const newRecipe = {
      id: nextRecipeId++,
      content: content
    };

    // 4. Sauvegarde la recette dans la ville
    if (!recipesByCity[cityId]) {
      recipesByCity[cityId] = [];
    }
    recipesByCity[cityId].push(newRecipe);

    // 5. Envoie de la réponse
    return reply.code(201).send(newRecipe);

  } catch (err) {
    console.error(err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});


// ✅ Maintenant seulement tu lances le serveur
fastify.listen(
  {
    port: process.env.PORT || 3000,
    host: process.env.RENDER_EXTERNAL_URL ? '0.0.0.0' : process.env.HOST || 'localhost',
  },
  function (err) {
    if (err) {
      fastify.log.error(err)
      process.exit(1)
    }

    // 🚨 Ne surtout pas déplacer cette ligne
    submitForReview(fastify)
  }
);
