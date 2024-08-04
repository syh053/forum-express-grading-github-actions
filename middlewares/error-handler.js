const errHandler = {
  generalError: (err, req, res, next) => {
    if (err instanceof Error) {
      req.flash('error_msg', `${err.name}: ${err.message}`)
    } else {
      req.flash('error_msg', `${err}`)
    }

    res.redirect('back')
  }
}

module.exports = errHandler
