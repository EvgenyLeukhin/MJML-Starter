// imports
const fs = require('fs');
const path = require('path');
const gulp = require('gulp');
const pipeIf = require('gulp-if');
const posthtml = require('gulp-posthtml');
const data = require('gulp-data');
const nunjucks = require('gulp-nunjucks');
const mjml = require('gulp-mjml');
const rename = require('gulp-rename');
const minimist = require('minimist');
const nunjucksEngine = require('nunjucks');
const mjmlEngine = require('mjml');
const browserSync = require('browser-sync');
const Yaml = require('js-yaml-import');

const options = minimist(process.argv.slice(2));
const server = browserSync.create();

// getDirectories
const getDirectories = (source) =>
  fs
    .readdirSync(source, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

function transpile(_cb) {
  return (
    gulp
      // single template - high perfomance
      // .src(path.join(__dirname, './src/templates/**/*/registry.mjml'))

      // all templates - low perfomance
      .src(path.join(__dirname, './src/templates/**/*.mjml'))

      // post html
      .pipe(
        posthtml([
          require('posthtml-include')({ root: path.join(__dirname, `./src`) }),
          require('posthtml-extend')({ root: path.join(__dirname, `./src`) }),
        ])
      )

      // data yml file
      .pipe(
        data((file) => {
          const yaml = new Yaml([
            path.join(__dirname, 'src'),
            ...getDirectories(path.join(__dirname, 'src')).map((dir) =>
              path.join(__dirname, `./src/${dir}`)
            ),
          ]);

          const dirpath = path.dirname(file.path).replace(__dirname, '');
          const yamlFile = yaml.read(path.join(__dirname, dirpath, 'data.yaml'));

          return yamlFile;
        })
      )

      // add html comments
      .pipe(
        pipeIf(
          options.dev,
          nunjucks.compile(
            {
              startMsoConditionalTag: '<!--[if mso | IE]><!-- -->',
              startMsoNegationConditionalTag: '<!--[if !mso]><!-- -->',
              endConditionalTag: '<!--<![endif]-->',
              startHideConditionalTag: '<!--[if mso | IE]>',
              endHideConditionalTag: '<![endif]-->',
            },
            {
              env: new nunjucksEngine.Environment(
                new nunjucksEngine.FileSystemLoader([
                  path.join(__dirname, 'src'),
                  ...getDirectories(path.join(__dirname, 'src')).map((dir) =>
                    path.join(__dirname, `./src/${dir}`)
                  ),
                ]),
                { autoescape: false }
              ),
            }
          )
        )
      )

      // rename
      .pipe(rename((path) => ({ dirname: '', basename: path.dirname, extname: '.mjml' })))

      // mjml destenation
      .pipe(gulp.dest(path.join(__dirname, './dist/mjml')))

      // minify
      .pipe(mjml(mjmlEngine, { beautify: options.dev, minify: options.prod }))

      // html destenation
      .pipe(gulp.dest(path.join(__dirname, './dist/html')))
  );
}

// gulp watch
function watch(cb) {
  if (!options.build) {
    gulp.watch(['./src/**/*.mjml', './src/**/*.yaml'], gulp.series(transpile, reload));
  } else {
    cb();
  }
}

// reload
function reload(done) {
  server.reload();
  done();
}

// gulp dev
function serve(done) {
  server.init({ server: { baseDir: './dist/html', directory: true } });
  done();
}

// gulp move
function move(_cb) {
  return gulp.src(`./dist/html/**/*`).pipe(gulp.dest(path.join(__dirname, options.to)));
}

exports.serve = gulp.parallel(gulp.series(transpile, serve), watch);

exports.build = transpile;

exports.move = move;
