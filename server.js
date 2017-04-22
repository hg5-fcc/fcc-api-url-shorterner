'use strict';
const express = require('express');
const app     = express();
const assert  = require('assert');

const mongo_uri = process.env.MONGOHQ_URL ||
    'mongodb://localhost/fcc-api-url-shorterner';

const MongoClient = require('mongodb').MongoClient

app.get('/new/*', (req, res) => {
    const url_validator = require('valid-url');
    const url           = req.originalUrl.replace(/^\/new\//, '');
    let data            = {original_url: url, short_url: null};

    if (url_validator.isUri(url)) {

        MongoClient.connect(mongo_uri, (err, db) => {
            assert.equal(null, err);

            const shortUrl          = db.collection('shortUrl');
            const sendResAndCloseDB = () => {
                res.send(JSON.stringify({original_url: data.original_url, short_url: data.short_url}));
                db.close();
            }

            shortUrl
                .findOne({original_url: url})
                .then((doc) => {
                    if (doc) {
                        data.short_url = req.protocol + '://' + req.get('Host') + '/' + doc.short_url;
                        sendResAndCloseDB();
                    } else {
                        shortUrl
                            .find({}).sort({shortUrl: -1}).limit(1).toArray()
                            .then(
                                (doc) => {
                                    data.short_url = doc.length > 0 ? doc[0].short_url + 1 : 0;

                                    shortUrl.insertOne(data)
                                        .then(sendResAndCloseDB)
                                        .catch(sendResAndCloseDB);
                                })
                            .catch(sendResAndCloseDB);
                    }
                })
                .catch(sendResAndCloseDB);
        });

    } else {
        data['error'] = 'Wrong url format, make sure you have a valid protocol and real site.';
        res.send(JSON.stringify(data));
    }
});

app.get('/:shorten_url', (req, res) => {
    const url = parseInt(req.params.shorten_url);

    const ReturnErrorResponse = (msg) => {
        res.send({error: msg});
    }

    if (isNaN(url)) {
        ReturnErrorResponse('This url is not on the database.');

    } else {

        MongoClient.connect(mongo_uri, (err, db) => {
            assert.equal(null, err);
            console.log(url);
            db.collection('shortUrl').findOne({short_url: url})
                .then((doc) => {
                    res.redirect(doc.original_url);
                }).catch(() => {
                ReturnErrorResponse('This url is not on the database.')
            });
        });
    }
});

const listen_port = process.env.PORT || 8080;
app.listen(listen_port, () => {
    console.log('app listening on port ' + listen_port);
});
