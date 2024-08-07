const express = require('express')
const router = express.Router()

// 載入 admin-controller
const admin = require('./modules/admin')

// 載入 restaurant-controller
const restController = require('../controllers/restaurant-controller')

// 載入 user-controller
const userController = require('../controllers/user-controller')

// 載入 authenticated、authenticatedAdmin 狀態
const { authenticated: auth, authenticatedAdmin: authAdmin } = require('../middlewares/auth')

// 載入錯誤 message
const errMessage = require('../middlewares/error-handler')

// 引入設定好的 passport
const passport = require('../config/passport')

router.use('/admin', authAdmin, admin)

router.get('/signup', userController.signUpPage)

router.post('/signup', userController.signUp)

router.get('/signin', userController.signInPage)

router.post('/signin', passport.authenticate('local', { failureRedirect: '/signin', failureFlash: true }), userController.signIn)

router.get('/logout', userController.signOut)

router.get('/restaurants', auth, restController.getRestaurnats)

// 若匹配不到路由，最後進到從導向路由
router.use('/', (req, res) => res.redirect('/restaurants'))

router.use(errMessage.generalError)

module.exports = router
