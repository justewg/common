"use strict";

const request = require('request-promise')

const common = require('./index')
const logger = require('./logger')()
logger.setLogLevel({except: 'requests'})


require('dotenv').config()


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
        const token = SESSION_TOKEN || (user && (user.token || user.get('token')))
        
        // Если url не начинается со слэша - добавляем
        if (!url.match(/^\//)) {
            url = '/' + url
        }
        
        // Формируем опции запроса
        let opts = {
            headers: token ? { 'Authorization': 'Bearer ' + token } : null,
            rejectUnauthorized: false,
            method: args.method || 'POST',
            url: `${API_URL}${url}`,
        }
        let clearedArgs = common.objectExceptFields(args, 'API_URL method')
        if (opts.method === 'POST' || opts.method === 'PUT') {
            opts.form = clearedArgs
        } else if (Object.keys(clearedArgs).length > 0) {
            opts.url += (opts.url.match(/\?/) ? '&' : '?') + new URLSearchParams(clearedArgs).toString()
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
                } else {
                    try {
                        responseJSON = JSON.parse(body)
                    } catch (err) {
                        if (logger.includes('responses')) {
                            logger.log('body: ', body)
                        }
                        if (logger.includes('errors')) {
                            logger.error('context:', ctx)
                            logger.error('error:', err)
                        }
                    }
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