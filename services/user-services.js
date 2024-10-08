const { Restaurant, Comment, Favorite, Like, Followship } = require('../db/models') // 載入 Restaurant, Favorite 物件

const { User } = require('../db/models') // 載入 User
const bcrypt = require('bcryptjs')

const localFileHandler = require('../helpers/file-helpers') // 載入檔案處理 helper

const userServices = {

  signUp: (req, cb) => {
    const { name, email, password, passwordCheck } = req.body
    // 建立正規表達式
    const regex = /@/g

    if (password !== passwordCheck) throw new Error('"Password Check" do not match "Password" !!')

    if (!regex.test(email)) throw new Error('"email must contain "@" !!')

    User.findOne({ where: { email } })
      .then(user => {
        if (user) throw new Error('This email is already exists!!')

        return bcrypt.hash(password, 10)
      })
      .then(hash => User.create({
        name,
        email,
        password: hash
      }))
      .then(newUser => cb(null, newUser))
      .catch(err => cb(err)) // 錯誤處理
  },

  getUser: (req, cb) => {
    const { id } = req.params

    return User.findByPk(id, {
      // raw: true,
      include: [
        {
          model: Comment,
          include: Restaurant,
          separate: true,
          order: [['createdAt', 'DESC']]
          // group: ['Restaurant.id'] // 用 sequelize 方法剔除重複評論的餐廳
        },
        {
          model: User,
          as: 'Followers'
        },
        {
          model: User,
          as: 'Followings'
        },
        {
          model: Restaurant,
          as: 'FavoritedRestaurants'
        }
      ]
    })
      .then(user => {
        if (!user) throw new Error("User didn't found!")

        /*
        去除重複的餐廳 :
        用 filter 遍歷每個 comments 內的餐廳 id，再用 if 判斷 temp 是否有重複的 key 值，
        若沒有則新增 key 到 temp 中，並把 comment 加到 newComments。
        */
        const comments = user.toJSON().Comments

        const temp = {}

        const newComments = comments.filter(comment => {
          const restaurantId = comment.Restaurant?.id
          if (!(restaurantId in temp)) {
            temp[restaurantId] = ''
            return true
          }
          return false
        })

        cb(null, { user: user.toJSON(), comments: newComments })
      })
      .catch(err => cb(err))
  },

  putUser: (req, cb) => {
    const { id } = req.params
    const { name } = req.body

    if (!name) throw new Error('name field is required!')

    const { file } = req // 把檔案取出來，也可以寫成 const file = req.file

    return Promise.all([ // 非同步處理
      User.findByPk(id), // 去資料庫查有沒有這間餐廳
      localFileHandler(file) // 把取出的檔案傳給 file-helper 處理後
    ])
      .then(([user, file]) => {
        if (!user) throw Error("User didn't exist!")
        if (Number(id) !== req.user.id) throw new Error('不能修改別人的資料!')

        return user.update({
          name,
          email: user.email,
          password: user.password,
          isAdmin: user.isAdmin,
          image: file || user.image // // 如果 file 是 Truthy (使用者有上傳新照片) 就用 file，如果是 Falsy (使用者沒有上傳新照片) 就沿用原本資料庫內的值
        })
      })
      .then(updateUser => cb(null, updateUser))
      .catch(err => cb(err))
  },

  addFavorite: (req, cb) => {
    const { restaurantId } = req.params
    const userId = req.user.id

    return Promise.all([
      Restaurant.findByPk(restaurantId),
      Favorite.findOne({
        where: { userId, restaurantId }
      })
    ])
      .then(([restaurant, favorite]) => {
        if (!restaurant) throw new Error("Restaurant didn't exist!")
        if (favorite) throw new Error('You have favorited this restaurant!')

        return [Favorite.create({ restaurantId, userId }), restaurant]
      })
      .then(([create, restaurant]) => cb(null, restaurant))
      .catch(err => cb(err))
  },

  removeFavorite: (req, cb) => {
    const { restaurantId } = req.params
    const userId = req.user.id

    return Favorite.findOne({
      where: { userId, restaurantId }
    })
      .then(async favorite => {
        if (!favorite) throw new Error("You haven't favorited this restaurant")

        const restaurant = await Restaurant.findByPk(restaurantId, { raw: true })

        return [favorite.destroy(), restaurant]
      })
      .then(([destroy, restaurant]) => cb(null, restaurant))
      .catch(err => cb(err))
  },

  addLike: (req, cb) => {
    const { restaurantId } = req.params
    const userId = req.user.id

    return Promise.all([
      Restaurant.findByPk(restaurantId, { raw: true }),
      Like.findOne({ where: { userId, restaurantId } })
    ])
      .then(([restaurant, like]) => {
        if (!restaurant) throw new Error("Restaurant didn't exist!")
        if (like) throw new Error('You have liked this restaurant!')

        return [Like.create({ restaurantId, userId }), restaurant]
      })
      .then(([create, restaurant]) => cb(null, restaurant))
      .catch(err => cb(err))
  },

  removeLike: (req, cb) => {
    const { restaurantId } = req.params
    const userId = req.user.id

    return Like.findOne({ where: { userId, restaurantId } })
      .then(async like => {
        if (!like) throw new Error("You haven't liked this restaurant!")

        const restaurant = await Restaurant.findByPk(restaurantId, { raw: true })

        return [like.destroy(), restaurant]
      })
      .then(([destroy, restaurant]) => cb(null, restaurant))
      .catch(err => cb(err))
  },

  getTopUsers: (req, cb) => {
    return User.findAll({ // 撈出所有 User 與 followers 資料
      // raw: true,
      // nest: true,
      include: [{
        model: User,
        as: 'Followers'
      }]
    })
      .then(users => {
        const topNumber = 4
        // 整理 users 資料，把每個 user 項目都拿出來處理一次，並把新陣列儲存在 result 裡
        const result = users
          .map(user => ({
            ...user.toJSON(), // 解構 user 物件
            followerCount: user.Followers.length, // 在每個 user 新增 followerCount 屬性
            isFollowed: req.user.Followings.some(f => f.id === user.id)
          }))
          .sort((a, b) => b.followerCount - a.followerCount) // 利用 sort() 方法針對 followerCount 整理排序
          .slice(0, topNumber)

        return cb(null, { users: result })
      })
      .catch(err => cb(err))
  },

  addFollowing: (req, cb) => {
    const { userId } = req.params

    return Promise.all([
      User.findByPk(userId, { raw: true }),
      Followship.findOne({
        where: {
          followerId: req.user.id,
          followingId: userId
        }
      })
    ])
      .then(([user, followship]) => {
        if (!user) throw new Error("User didn't exist!")
        if (followship) throw new Error('You are already following this user!')

        return Followship.create({
          followerId: req.user.id,
          followingId: userId
        })
      })
      .then(newFollowship => cb(null, newFollowship))
      .catch(err => cb(err))
  },

  removeFollowing: (req, cb) => {
    const { userId } = req.params

    return Followship.findOne({
      where: {
        followerId: req.user.id,
        followingId: userId
      }
    })
      .then(followship => {
        if (!followship) throw new Error("You haven't followed this user!")

        return followship.destroy({
          where: { followingId: userId }
        })
      })
      .then(destroy => cb(null, destroy))
      .catch(err => cb(err))
  }

}

module.exports = userServices
