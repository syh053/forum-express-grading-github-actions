const { User, Restaurant, Category, Comment } = require('../db/models') // 載入 Restaurant、User、Category、Comment 物件

const { getOffset, getPagination } = require('../helpers/pagination-helper') // 載入分頁 helper

const { getUser } = require('../helpers/auth-helpers')

const restaurantServices = {
  getRestaurants: (req, cb) => {
    const page = Number(req.query.page) || 1
    const categoryId = Number(req.query.categoryId) || ''

    const DEFAULT_LIMIT = 9 // 指定 limit 為 9，避免 magic number!!
    const limit = Number(req.query.limit) || DEFAULT_LIMIT
    const offset = getOffset(page, DEFAULT_LIMIT)

    return Promise.all([
      Restaurant.findAndCountAll({
        where: {
          ...categoryId ? { categoryId } : {} // 用三元運算子判斷 categoryId 是否存在，若存在傳入 { categoryId }，不存在傳入{}
        },
        offset,
        limit,
        raw: true,
        nest: true,
        include: Category
      }),
      Category.findAll({ raw: true })
    ])

      .then(([restaurants, categories]) => {
        // 用可選串連運算子避免 null 或 undefined 引發的錯誤，等價於下一句方法
        const favoritedRestaurants = req.user?.FavoritedRestaurants ? req.user.FavoritedRestaurants.map(restaurants => restaurants.id) : []
        // 用 && 短路求值設計避免 null 或 undefined 引發的錯誤，等價於上一句方法
        const likedRestaurants = req.user && req.user.LikeRestaurants ? req.user.LikeRestaurants.map(restaurant => restaurant.id) : []

        const datas = restaurants.rows.map(restaurant => {
          return {
            ...restaurant,
            description: restaurant.description?.slice(0, 50),
            isFavorited: favoritedRestaurants.includes(restaurant.id),
            isLiked: likedRestaurants.includes(restaurant.id)
          }
        })
        return cb(null, {
          restaurants: datas,
          categories,
          categoryId,
          pagination: getPagination(limit, page, restaurants.count) // 傳入分頁參數
        })
      })
      .catch(err => cb(err))
  },

  getRestaurant: (req, cb) => {
    const { id } = req.params

    return Restaurant.findByPk(id, {
      include: [
        Category,
        {
          model: Comment,
          include: User,
          separate: true,
          order: [['createdAt', 'DESC']]
        },
        {
          model: User,
          as: 'FavoritedUsers'
        },
        {
          model: User,
          as: 'LikeUsers'
        }
      ]
    })
      .then(restaurant => {
        if (!restaurant) throw new Error('Restaurant not found')

        return restaurant.increment('viewCounts')
      })
      .then(restaurant => {
        const isFavorited = restaurant.FavoritedUsers.some(fs => fs.id === req.user.id)
        const isLiked = restaurant.LikeUsers.some(ls => ls.id === req.user.id)

        return cb(null, {
          restaurant: restaurant.toJSON(),
          isFavorited,
          isLiked
        })
      })
      .catch(err => cb(err))
  },

  getDashboard: (req, cb) => {
    const { id } = req.params

    return Restaurant.findByPk(id, {
      // raw: true,
      // nest: true,
      include: [
        Category,
        Comment,
        { model: User, as: 'FavoritedUsers' }
      ]
    })
      .then(restaurant => {
        if (!restaurant) throw new Error('Restaurant not found')

        return cb(null, { restaurant: restaurant.toJSON() })
      })
      .catch(err => cb(err))
  },

  getFeeds: (req, cb) => {
    Promise.all([
      Restaurant.findAll({
        raw: true,
        nest: true,
        order: [['createdAt', 'DESC']],
        include: Category,
        limit: 4
      }),
      Comment.findAll({
        raw: true,
        nest: true,
        order: [['createdAt', 'DESC']],
        include: [User, Restaurant],
        limit: 10
      })
    ])
      .then(([restaurants, comments]) => {
        const datas = restaurants.map(restaurant => (
          {
            ...restaurant,
            description: restaurant.description?.length < 50
              ? restaurant.description
              : restaurant.description?.slice(0, 50) + '...'
          }
        ))

        cb(null, { restaurants: datas, comments })
      })
      .catch(err => cb(err))
  },

  getTopRestaurants: (req, cb) => {
    const user = getUser(req)

    return Restaurant.findAll({
      include: [
        {
          model: User,
          as: 'FavoritedUsers'
        }
      ]
    })
      .then(restaurants => {
        const result = restaurants
          .map(restaurant => ({
            ...restaurant.toJSON(),
            description: restaurant.description?.length < 50
              ? restaurant.description
              : restaurant.description?.slice(0, 50) + '...',
            favoritedCount: restaurant.FavoritedUsers.length,
            isFavorited: user && user.FavoritedRestaurants.some(fr => fr.id === restaurant.id)
          }))
          .sort((a, b) => b.favoritedCount - a.favoritedCount)
          .slice(0, 10)

        return cb(null, { restaurants: result })
      })
      .catch(err => cb(err))
  }

}

module.exports = restaurantServices
