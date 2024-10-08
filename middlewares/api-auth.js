const passport = require('../config/passport')

const localAuthenticated = (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user) => {
    if (err || !user) return res.status(401).json({ status: 'error', message: 'unauthorized' })

    req.user = user

    next()
  })(req, res, next)
}

const authenticated = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err || !user) return res.status(401).json({ status: 'error', message: 'unauthorized' })

    req.user = user

    next()
  })(req, res, next)
}

const authenticatedAdmin = (req, res, next) => {
  if (req.user?.isAdmin) return next()
  return res.status(403).json({
    status: 'error',
    message: 'permission denied'
  })
}

module.exports = { localAuthenticated, authenticated, authenticatedAdmin }
