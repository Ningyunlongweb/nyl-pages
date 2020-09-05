#!/usr/bin/env node
process.argv.push('--cwd')
process.argv.push(process.cwd())
process.argv.push('--gulpfile')
process.argv.push(require.resolve('..')) // 当前文件.. 上一层路径，当gulpfile查找文件时后，因为指定到了根目录，这时候没有指定特定文件，会从package.json main字段查找

require('gulp/bin/gulp')