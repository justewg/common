'use strict';

const url = require('url')
const fs = require('fs')
const JsonWebToken = require('jsonwebtoken');

const logger = require('./logger')();


require('dotenv').config()

/**
 * Читает директорию и возвращает список ее файлов
 *
 * @param dir
 * @returns {Promise.<Array>}
 */
async function listDir(dir) {
    let files = []
    try {
        files = await fs.promises.readdir(dir)
    } catch (e) {
        logger.error('Ошибка чтения директории ' + dir, e);
    }
    return files
}
module.exports.listDir = listDir;

/**
 *
 * @param pattern
 * @param url
 * @returns {any}
 */
const getParamsFromQuery = (pattern, url) => {
    const re = new RegExp(pattern.replace(/\{([^\}]+)\}/g, '(?<$1>[^\/]+)'))
    const matches = re.exec(url)
    return matches !== null ? matches.groups : null
}

module.exports.getParamsFromQuery = getParamsFromQuery;

/**
 *
 * @param ctx
 * @param args
 * @returns {*}
 */
const getArgsFromQueryParams = (ctx, args) => {
    args = args || []
    const queryData = url.parse(ctx.request.url, true).query;
    args = args.filter(k => typeof queryData[k] !== 'undefined')
    return (args || []).reduce((obj, key) => ({...obj, [key]: queryData[key]}), {})
}

module.exports.getArgsFromQueryParams = getArgsFromQueryParams;

/**
 * Получает токен из заголовков запроса
 *
 * @param ctx - Контекст приложения
 * @returns {string} - Токен
 */
const getTokenFromHeaders = (ctx) => {
    return (ctx.request.header.authorization || '').replace(/^Bearer /, '')
}

module.exports.getTokenFromHeaders = getTokenFromHeaders;

/**
 * Проверяет валидность токен из заголовков запроса или из опций
 *
 * @param ctx - Контекст приложения
 * @param opts - Опции проверки:
 *               token: {string} - Токен который нужно проверить вместо того, чтобы взять его из заголовков запроса
 *               public: {bool} - Вернуть ли только публично доступные поля (см. модель User)
 * @returns {Promise.<*>} Объект, содержащий результаты верификации
 */
const verifyToken = async (ctx, opts) => {
    opts = opts || {}
    const tokenToVerify = opts.token && opts.token !== '' ? opts.token : getTokenFromHeaders(ctx)
    
    const result = {success: false}
    await JsonWebToken.verify(tokenToVerify, process.env.JWT_SECRET, {}, async (err, decoded) => {
        if (err) {
            result.error = err
        } else {
            result.success = true
            result.data = decoded
            
            // const u = await User.findOne({email: token.user}).exec();
            // if (!u) {
            //     result.success = false
            //     result.error = 'User not found'
            // } else {
            //     result.ttl = moment(token.exp * 1000).diff(moment()) / 1000 / 60
            //     result.user = u.toClient(ctx)
            //     result.user.token = tokenToVerify
            // }
        }
    })
    return result
}

module.exports.verifyToken = verifyToken;

module.exports.objectWithOnlyFields = (obj, keys) => {
    obj = obj || {}
    if ('string' === typeof keys) {
        keys = keys.split(/ +/)
    }
    return keys.reduce(function(ret, key){
        if (null === obj[key]) {
            return ret
        }
        ret[key] = obj[key]
        return ret
    }, {})
}

module.exports.objectExceptFields = (obj, keys) => {
    obj = obj || {}
    if ('string' === typeof keys) {
        keys = keys.split(/ +/)
    }
    return Object.keys(obj).reduce(function(ret, key){
        if (null === obj[key]) {
            return ret
        }
        if (keys.indexOf(key) === -1) {
            ret[key] = obj[key]
        }
        return ret
    }, {})
}

module.exports.limitArrayWithEllipsis = (a, limit) => {
    return (a.length > limit ? a.slice(0, ~~(limit / 2)).concat([{id: '...'}]).concat(a.slice(a.length - ~~(limit / 2) - limit % 2 + 1, a.length)) : a)
}
