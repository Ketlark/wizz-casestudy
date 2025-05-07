const express = require('express');
const bodyParser = require('body-parser');
const db = require('./models');

const app = express();

const axios = require('axios');

const BUCKET_URL_ANDROID = "https://wizz-technical-test-dev.s3.eu-west-3.amazonaws.com/android.top100.json";
const BUCKET_URL_IOS = "https://wizz-technical-test-dev.s3.eu-west-3.amazonaws.com/ios.top100.json";

app.use(bodyParser.json());
app.use(express.static(`${__dirname}/static`));

app.get('/api/games', (req, res) => db.Game.findAll()
  .then(games => res.send(games))
  .catch((err) => {
    console.log('There was an error querying games', JSON.stringify(err));
    return res.send(err);
  }));

app.post('/api/games', (req, res) => {
  const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
  return db.Game.create({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
    .then(game => res.send(game))
    .catch((err) => {
      console.log('***There was an error creating a game', JSON.stringify(err));
      return res.status(400).send(err);
    });
});

app.post('/api/games/search', (req, res) => {
  const { name, platform } = req.body;
  const whereClause = {};
  
  if (platform) {
    whereClause.platform = platform;
  }
  
  if (name) {
    whereClause.name = {
      [db.Sequelize.Op.like]: `%${name}%`
    };
  }

  return db.Game.findAll({ where: whereClause })
    .then(games => res.send(games))
    .catch((err) => {
      console.log('Error during searching games', JSON.stringify(err));
      return res.status(400).send(err);
    });
});

app.delete('/api/games/:id', (req, res) => {
  // eslint-disable-next-line radix
  const id = parseInt(req.params.id);
  return db.Game.findByPk(id)
    .then(game => game.destroy({ force: true }))
    .then(() => res.send({ id }))
    .catch((err) => {
      console.log('***Error deleting game', JSON.stringify(err));
      res.status(400).send(err);
    });
});

app.put('/api/games/:id', (req, res) => {
  // eslint-disable-next-line radix
  const id = parseInt(req.params.id);
  return db.Game.findByPk(id)
    .then((game) => {
      const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
      return game.update({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
        .then(() => res.send(game))
        .catch((err) => {
          console.log('***Error updating game', JSON.stringify(err));
          res.status(400).send(err);
        });
    });
});


app.post('/api/games/populate', async (req, res) => {
  try {
    const [androidResponse, iosResponse] = await Promise.all([
      axios.get(BUCKET_URL_ANDROID),
      axios.get(BUCKET_URL_IOS)
    ]);

    const androidGames = androidResponse.data.flat().map(game => ({
      publisherId: game.publisher_id || game.publisherId || '',
      name: game.name || '',
      platform: 'android',
      storeId: game.id || '',
      bundleId: game.bundle_id || '',
      appVersion: game.app_version || game.version || '',
      isPublished: true,
    }));

    const iosGames = iosResponse.data.flat().map(game => ({
      publisherId: game.publisher_id || game.publisherId || '',
        name: game.name || '',
        platform: 'ios',
        storeId: game.id || '',
        bundleId: game.bundle_id || '',
        appVersion: game.app_version || game.version || '',
        isPublished: true,
    }));

    const allGames = [...androidGames, ...iosGames];
    await db.Game.bulkCreate(allGames, { ignoreDuplicates: true });
    
    res.send({ success: true, count: allGames.length });
  } catch (err) {
    console.log('Error while populating database :', JSON.stringify(err));
    res.status(500).send(err);
  }
});

app.listen(3000, () => {
  console.log('Server is up on port 3000');
});

module.exports = app;
