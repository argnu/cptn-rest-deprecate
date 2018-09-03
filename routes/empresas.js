const utils = require('../utils');
const router = require('express').Router();
const model = require('../model');
const auth = require('../auth');

router.use(function(req, res, next) {
  if (req.method == 'OPTIONS') next();
  else if (req.ability.can(auth.getMethodAbility(req.method), 'Empresa')) next();
  else utils.sinPermiso(res);
});

router.get('/', function(req, res) {
  model.Empresa.getAll(req.query)
    .then(r => res.json(r))
    .catch(e => utils.errorHandler(e, req, res));
});

router.get('/:id', function(req, res) {
  model.Empresa.get(req.params.id)
    .then(r => res.json(r))
    .catch(e => utils.errorHandler(e, req, res));
});

router.get('/:id/contactos', function(req, res) {
  model.Contacto.getAll(req.params.id)
    .then(r => res.json(r))
    .catch(e => utils.errorHandler(e, req, res));
});

router.post('/', function(req, res) {
  if(!req.ability.can('create', 'Empresa')) utils.sinPermiso(res);

  model.Profesional.add(req.body)
    .then(r => res.status(201).json(r))
    .catch(e => utils.errorHandler(e, req, res));
});

module.exports = router;
