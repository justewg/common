'use strict';

const url = require('url')
const fs = require('fs')
const JsonWebToken = require('jsonwebtoken')
const moment = require('moment')

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
            const minutesToExpire = Math.floor(moment(decoded.exp * 1000).diff(moment()) / 1000 / 60)
            decoded.expired = minutesToExpire < 0
            decoded.minutes_to_expire = minutesToExpire
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

// https://gist.github.com/ahtcx/0cd94e62691f539160b32ecda18af3d6
const mergeDeepV1 = (target, source, options = { arraysMergingType: "overwrite" }) => {
    target = ((obj) => {
        let cloneObj;
        try {
            cloneObj = JSON.parse(JSON.stringify(obj));
        } catch(err) {
            // If the stringify fails due to circular reference, the merge defaults
            //   to a less-safe assignment that may still mutate elements in the target.
            // You can change this part to throw an error for a truly safe deep merge.
            cloneObj = Object.assign({}, obj);
        }
        return cloneObj;
    })(target);

    const isObject = (obj) => obj && typeof obj === "object";

    if (!isObject(target) || !isObject(source))
        return source;

    Object.keys(source).forEach(key => {
        const targetValue = target[key];
        const sourceValue = source[key];

        if (Array.isArray(targetValue) && Array.isArray(sourceValue))
            if (options.arraysMergingType === "map") {
                target[key] = targetValue.map((x, i) => sourceValue.length <= i
                    ? x
                    : mergeDeepV1(x, sourceValue[i], options));
                if (sourceValue.length > targetValue.length)
                    target[key] = target[key].concat(sourceValue.slice(targetValue.length));
            } else if (options.arraysMergingType === "concat") {
                target[key] = targetValue.concat(sourceValue);
            } else if (options.arraysMergingType === "overwrite") {
                target[key] = sourceValue;
            } else {
                console.error("Wrong arraysMergingType option assigned")
            }
        else if (isObject(targetValue) && isObject(sourceValue))
            target[key] = mergeDeepV1(Object.assign({}, targetValue), sourceValue, options);
        else
            target[key] = sourceValue;
    });

    return target;
};
const deepMergeV2 = (source, target, arrayMergeType)  => {
    return void Object.keys(target).forEach(key => {
        source[key] instanceof Object && target[key] instanceof Object
            ? source[key] instanceof Array && target[key] instanceof Array
                ? void (source[key] = Array.from(new Set(source[key].concat(target[key]))))
                : !(source[key] instanceof Array) && !(target[key] instanceof Array)
                    ? void deepMergeV2(source[key], target[key])
                    : void (source[key] = target[key])
            : void (source[key] = target[key]);
    }) || source;
}


module.exports.mergeDeep = mergeDeepV1;