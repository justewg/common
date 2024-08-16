'use strict';

const moment = require('moment')

const colors = require('../constants/color')


require('dotenv').config()


const LOG_INIT = 'init'                     // строки инициализации классов, модулей
const LOG_QUERIES = 'queries'               // строки запросов к БД
const LOG_METHOD_CALLS = 'method_calls'     // вызовы методов
const LOG_REQUESTS = 'requests'             // запросы к API
const LOG_RESPONSES = 'responses'           // ответы от API и БД
const LOG_ERRORS = 'errors'                 // ошибки
const LOG_DEBUG = 'debug'                   // отладочная информация

// Уровень логирования всего кроме ошибок
const LOG_ALL = [LOG_INIT, LOG_QUERIES, LOG_METHOD_CALLS, LOG_REQUESTS, LOG_RESPONSES, LOG_DEBUG, LOG_ERRORS]

// Уровень отсутствия логирования
// const LOG_OFF = []
// const SILIENT = LOG_OFF

// Позволять ли цветовую раскраска лога (true|false)
const COLOR = !process.env.hasOwnProperty('COLOR_LOG') || ['0', 'off'].indexOf(process.env.COLOR_LOG.toLowerCase()) === -1


let LOG_LEVEL = LOG_ALL


/**
 * Устанавливает уровень логирования
 *
 * @param level Строка, массив или объект с указанием констант уровней логирования
 */
const setLogLevel = (level) => {
    if (typeof level === 'string' || Array.isArray(level)) {
        LOG_LEVEL = level
    } else if (typeof level === 'object' && level.hasOwnProperty('except')) {
        if (typeof level.except === 'string') {
            level.except = level.except.split(/ +/)
        }
        LOG_LEVEL = LOG_ALL.filter(l => level.except.indexOf(l) === -1)
    }
}

/**
 * Возвращает текущие дату и время в нужном для логов формате
 *
 * @returns {*}
 */
const getDT = () => {
    return moment().format("DD/MM/YYYY HH:mm:ss")
}

/**
 * Возвращает скрипт откуда был вызван лог через фейковый еррор-стек
 *
 * @returns {string}
 */
const getRelPathFrom = () => {
    let relPath = ''
    try {
        throw new Error();
    } catch (e) {
        const pathToFile = e.stack.split('\n')[3].replace(/^.+\(([^)]+)\).*$/, '$1')
        relPath = colors.FadeOn + '(' + (pathToFile ? pathToFile.replace(new RegExp(process.cwd()), '') : pathToFile) + ')' + colors.Reset
    }
    return relPath
}

/**
 * Возвращает флаг того, входит ли переданная сущность в текущий уровень логирования
 *
 * @param what
 * @returns {boolean}
 */
const includes = (what) => {
    let level = LOG_LEVEL
    if (typeof level === 'string') {
        level = level.split(/ +/)
    }
    return level.indexOf(what) > -1
}

/**
 * Очищает массив текстовых аргументов от цветовых кодов терминальной консоли
 *
 * @param args
 * @returns {Array}
 */
const removeColors = (args) => {
    return args.map(s => {
        Object.keys(colors).map(ck => {
            if (typeof s === 'string') {
                s = s.replace(colors[ck], '')
            }
        })
        return s
    })
}

/**
 * Создает интерфейс объекта логирования
 *
 * @param loggerModule - Объект логирования (default: console)
 * @returns {{log: (function(...[*]=)), error: (function(...[*]=)), debug: (function(...[*]=)), includes: (function(*=)), setLogLevel: (function(*=))}}
 */
const getLoggerModule = (loggerModule) => {
    if (!loggerModule) {
        loggerModule = console
    }
    return {
        log: ((...args) => {
            args = [].concat.apply([].concat.apply([getDT()], args).concat([getRelPathFrom()]))
            if (!COLOR) {
                args = removeColors(args)
            }
            loggerModule.log.apply(null, args)
        }),
        error: ((...args) => {
            let sign = '🚫'
            if (!includes(LOG_ERRORS)) {
                args = ['Логирование ошибок отключено']
                sign = '⚠️'
            }
            args = [].concat.apply([].concat.apply([getDT()], [sign + ' ']).concat(args).concat([getRelPathFrom()]))
            if (!COLOR) {
                args = removeColors(args)
            }
            loggerModule.error.apply(null, args)
        }),
        debug: ((...args) => {
            if (!includes(LOG_DEBUG)) {
                args = ['⚠️  Логирование отладочной информации отключено']
            }
            args = [].concat.apply([].concat.apply([getDT()], args).concat([getRelPathFrom()]))
            if (!COLOR) {
                args = removeColors(args)
            }
            loggerModule.debug.apply(null, args)
        }),
        includes: includes,
            setLogLevel: setLogLevel
    }
}

module.exports = (args = {}) => {
    // Если логгер был подключен с параметром логирования в файл - инициализируем модуль записи логов в файл, иначе - обычная консоль
    if (args.hasOwnProperty('log_to_file') && args['log_to_file'] === true) {
        const fs = require('fs')
        const Console = require('console')

        require('dotenv').config()

        const logfile = args.log_file || __dirname + '/../' + process.env.LOG_FILE

        const output = fs.createWriteStream(logfile, { 'flags': 'a' });
        const errorOutput = fs.createWriteStream(logfile, { 'flags': 'a' });
        const loggerModule = new Console.Console(output, errorOutput);

        return getLoggerModule(loggerModule)
    } else {
        return getLoggerModule(console)
    }
}
