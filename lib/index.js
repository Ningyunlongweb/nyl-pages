const { src, dest, parallel, series, watch } = require('gulp')
const path = require('path')

const plugins = require('gulp-load-plugins')()

const browserSync = require('browser-sync')


const bs = browserSync.create() // 自动创建一个开发服务器

const del = require('del')
// 传入的数据
const cwd = process.cwd() // 返回当前命令行所在的工作目录
let config = {
  build:{
    src: 'src',
    dist: 'dist',
    temp: 'temp',
    public: 'public',
    paths: {
      styles: 'assets/styles/*.scss',
      scripts: 'assets/scripts/*.js',
      pages: '*.html',
      images: 'assets/images/**',
      fonts: 'assets/fonts/**'
    }
  }
}
try{
  const loadConfig = require(path.join(cwd, 'page.config.js'))
  config = Object.assign({}, config, loadConfig)
} catch(e){}

// 编译前删除之前编译的历史文件dist
const clean = () => {
  return del([config.build.dist, config.build.temp])
}

const style = () => {
  // base 参数 定义基准路径，如定义的src 这样 输出的文件会按照src之后的路径生成文件， dist/src/assets/style/*.css
  return src(config.build.paths.styles, { base: config.build.src, cwd: config.build.src }) // cwd 工程目框，也就是在哪找文件目录，默认是工程目录的根目录
    .pipe(plugins.sass({ outputStyle: 'expanded' })) // outputStyle 规定输出规则  expanded 展开输出，可以事后结尾中括号独占一行
    .pipe(dest(config.build.temp))
}

const script = () => {
  return src(config.build.paths.scripts, { base: config.build.src, cwd: config.build.src })
        .pipe(plugins.babel({ presets: [require('@babel/preset-env')] }))
        .pipe(dest(config.build.temp))
}

const page = () => {
  return src(config.build.paths.pages, { base: config.build.src, cwd: config.build.src })
        .pipe(plugins.swig({ defaults:{ cache: false }, data: config.data })) // cache去除swig插件打包缓存机制
        .pipe(dest(config.build.temp))
}
// 图片文件处理压缩
const image = () => {
  return src(config.build.paths.images, { base: config.build.src, cwd: config.build.src })
      .pipe(plugins.imagemin())
      .pipe(dest(config.build.dist))
}
// 字体文件处理，字体文件的没有需要处理的，唯一就是有svg文件需要处理，进行imagemin压缩
const font = () => {
  return src(config.build.paths.fonts, { base: config.build.src, cwd: config.build.src })
        .pipe(plugins.imagemin())
        .pipe(dest(config.build.dist))
}
// 将不需要编译的静态文件导出到dist中
const extra = () => {
  return src('**', { base: config.build.public, cwd: config.build.public })
        .pipe(dest(config.build.dist))
}

const useref = () => {
  return src(config.build.paths.pages, { base: config.build.temp, cwd: config.build.temp})
    .pipe(plugins.useref({ searchPath: [config.build.temp, '.']})) // searchPath 设置静态路径查找的位置，如有些静态文件再node_modules下面，所以设置了’.‘，还有dist下的。这样useref才能正确找到文件并处理。
    // useref 会处理 html css js 文件的读取流，所以这地方要用gulp-if判断分别处理
    .pipe(plugins.if(/\.js$/, plugins.uglify()))
    .pipe(plugins.if(/\.css$/, plugins.cleanCss()))
    .pipe(plugins.if(/\.html$/, plugins.htmlmin({
      collapseWhitespace: true, // 对空白字符清除
      minifyCSS: true, // 压缩html中片段css
      minifyJS: true // 压缩html 中片段js
    })))
    .pipe(dest(config.build.dist)) // 更改路径，为了避免读写丢同时操作dist文件夹冲突，导致读写失败。
}

// 由于w gulp任务都是异步任务 需要返回执行状态才能继续指导是否完成上个任务。由于bs.reload无法实现返回所以需要二次封装，返回promise，来告知执行状态是否完成。进行如下的二次封装
async function reload () {
  await bs.reload()
}

// 创建一个gulp serve任务来执行web服务器
const serve = async () => {

  watch(config.build.paths.styles, { cwd: config.build.src }, style)
  watch(config.build.paths.scripts, { cwd: config.build.src }, script)
  watch(config.build.paths.pages, { cwd: config.build.src }, page)
  watch([
    config.build.paths.images,
    config.build.paths.fonts,
  ], { cwd: config.build.src }, reload)
  watch('**', { cwd: config.build.public }, reload)
  // 初始化web服务器的核心配置
  await bs.init({
    notify: true, // 取消启动成功与否的提示
    port: 3000, // 设置web服务器的端口号
    // open: false // 控制浏览器是否自动打开
    files: path.join(config.build.temp, '**'), // 设置监听的路径，路径的通配符
    server: {
      baseDir: [config.build.temp, config.build.src, config.build.public], // 设置基础目录，路由中寻找的路径, 可以是字符串，也可以是数组，如果是数组的话，会依次找资源，找到就使用找不到就继续下一个找。
      routes: {       // 设置所有路由，优先级高于baseDir，也就是先去通过查找routes，再去查找baseDir下的文件
        '/node_modules': 'node_modules'
      }
    }
  })
}

// 三个任务相互独立 没有影响，所以我们使用并行组合任务。
const compile = parallel(style, script, page)

const build = series(clean, parallel(series(compile, useref), extra, image, font))

const develop = series(compile, serve)

module.exports = {
  clean,
  build,
  develop
}