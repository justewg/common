"use strict";

const request = require('request-promise')

const common = require('./index')
const logger = require('./logger')()
// logger.setLogLevel({except: 'requests'})


require('dotenv').config()

if (process.env.LOG_LEVEL !== '') {
    logger.setLogLevel(process.env.LOG_LEVEL)
}

/**
 * URL для внешнего API
 * @type {*|string}
 */
let API_URL = null

/**
 * Bearer-токен для авторизации запросов
 * @type {string|null}
 */
let SESSION_TOKEN = null

/**
 * Объект юзера сессии
 * @type {{}|null}
 */
let SESSION_USER = null


/**
 * Устанавливает токен авторизации
 *
 * @param token - Токен
 */
const setSessionToken = (token) => {
    SESSION_TOKEN = token
}

module.exports.setSessionToken = setSessionToken;

/**
 * Устанавливает объект пользователя
 *
 * @param user - Объект пользователя
 */
const setSessionUser = (user) => {
    SESSION_USER = user
}

module.exports.setSessionUser = setSessionUser;

/**
 * Вспомогательная функция для использования внешних и внутренних API
 *
 * @param ctx - Контекст приложения
 * @param url - Вызываемый URL
 * @param args - Аргументы вызова
 * @returns {Promise|null} - Promise-объект запроса
 */
const make = async (ctx, url, args = {}) => {
    API_URL = args.API_URL || process.env.API_URL
    if (API_URL === null) {
        logger.error('IAC API URL is not defined.')
        return null
    }

    return new Promise( async (resolve, reject) => {
        let user = SESSION_USER

        // Если определен контекст приложения - ищем там данные пользователя
        if (ctx && typeof ctx !== 'undefined') {
            const sessionField = args.session_field || 'session'

            // Ищем данные пользователя в поле состояния, определяемом default- или указанной переменной
            if (ctx[sessionField] && ctx[sessionField].user) {
                user = ctx[sessionField].user
            }
        }

        // Определяем авторизационный токен из объекта пользователя
        const token = SESSION_TOKEN || (ctx && ctx.session && ctx.session.token) || (user && (user.token || user.get('token')))

        // Если url не начинается со слэша - добавляем
        if (!url.match(/^\//)) {
            url = '/' + url
        }

        // Формируем опции запроса
        let opts = {
            timeout: args.timeout || 20000,
            headers: args.headers || (token ? { 'Authorization': 'Bearer ' + token } : null),
            rejectUnauthorized: args.hasOwnProperty('rejectUnauthorized') ? args.rejectUnauthorized : false,
            method: args.method || 'POST',
            url: `${API_URL}${url}`,
        }
        if (!args.hasOwnProperty('content_type')) {
            args.content_type = 'json'
        }
        const splitArraysToDormArgs = args.arrays_as_form_args === true
        let clearedArgs = common.objectExceptFields(args, 'API_URL method headers arrays_as_form_args content_type')
        if (splitArraysToDormArgs) {
            clearedArgs = Object.keys(clearedArgs).reduce((a, k) => a.concat(Array.isArray(clearedArgs[k]) ? clearedArgs[k].map(v => [k, v]) : [[k, clearedArgs[k]]]), [])
        }
        if (args.hasOwnProperty('gzip') === true) {
            opts.gzip = args.gzip
        }
        if (args.body) {
            opts.body = args.body
        } else if (args.formData) {
            opts.formData = args.formData
        } else if (args.multipart) {
            opts.multipart = args.multipart
        } else if (opts.method === 'POST' || opts.method === 'PUT') {
            opts.form = clearedArgs
        } else {
            opts.url += (Object.keys(clearedArgs).length > 0 ? (opts.url.match(/\?/) ? '&' : '?') : '') + new URLSearchParams(clearedArgs).toString().replace(/\+/g, '%20')
        }

        // Логируем параметры запросы
        if (logger.includes('requests')) {
            logger.log('Запрос:', opts)
        }

        // Осуществляем запрос
        request(opts, (error, response, body) => {
            if (!error) {
                let responseJSON = null
                if (body.match(/Authentication Error/)) {
                    reject({success: false, error: {message: body}})
                } else if (body.match(/Internal Server Error/)) {
                    reject({success: false, error: {message: body}})
                } else if (body === '') {
                    reject({success: false, error: {message: 'Пустой ответ'}})
                } else {
                    if (args.content_type === 'json'){
                        try {
                            responseJSON = JSON.parse(body)
                        } catch (err) {
                            // if (logger.includes('requests')) {
                                logger.log('запрос: ', opts)
                            // }
                            // if (logger.includes('responses')) {
                                logger.log('body: ', body)
                            // }
                            // if (logger.includes('errors')) {
                                logger.error('context:', ctx)
                                logger.error('error:', err)
                            // }
                            responseJSON = {success: false, error: err}
                        }
                        if (typeof responseJSON === 'string') {
                            responseJSON = {success: true, text: responseJSON}
                        }
                    } else {
                        responseJSON = {success: true, text: body}
                    }
                    responseJSON.status = (responseJSON && typeof(responseJSON) === 'object' ? responseJSON.status : response.statusCode) || 200
                }
                if (responseJSON !== null) {
                    if (!responseJSON.hasOwnProperty('error')) {
                        resolve(responseJSON)
                    } else {
                        reject(responseJSON)
                    }
                } else {
                    reject({success: false, error: {message: body}})
                }
            } else {
                reject(error)
            }
        }).catch(e => reject)
    })
}

module.exports.make = make;
