import Joi from 'joi'
import shortid from 'shortid'
import { cypher, cypherOne } from '../infra/neo4j'
import betterGroup from '../utils/groupUtils'
import initAnimalAdj from '../infra/animal-adj/animal-adj'

const animalAdj = initAnimalAdj('fr')

exports.register = function (server, options, next) {

    server.route([
        {
            method: 'POST',
            path: '/api/users/me',
            config: {
                auth: 'jwt-anonymous',
                validate: {
                    payload: Joi.object({
                        email: Joi.string().email().required(),
                        name: Joi.string(),
                        avatarUrl: Joi.string().uri({ scheme: 'https' }),
                        oAuthId: Joi.string(),
                        oAuthProvider: Joi.string(),
                    }).required(),
                },
                handler(req, reply) {

                    const id = shortid()
                    const anonymousName = animalAdj(id)

                    cypherOne(`
                        MERGE         (u:User { email: {email} })
                        ON CREATE SET u.createdAt        = timestamp(),
                                      u.updatedAt        = timestamp(),
                                      u.id               = {id},
                                      u.name             = {name},
                                      u.anonymousName    = {anonymousName},
                                      u.email            = {email},
                                      u.avatarUrl        = {avatarUrl},
                                      u.oAuthId          = {oAuthId},
                                      u.oAuthProvider    = {oAuthProvider},
                                      u.lastConnectionAt = timestamp(),
                                      u.isAnonymous      = false
                        ON MATCH SET  u.lastConnectionAt = timestamp()
                        RETURN        u.id            AS id,
                                      u.name          AS name,
                                      u.anonymousName AS anonymousName,
                                      u.avatarUrl     AS avatarUrl,
                                      u.isAnonymous   AS isAnonymous`,
                        {
                            id,
                            email: req.payload.email,
                            name: req.payload.name,
                            oAuthId: req.payload.oAuthId,
                            oAuthProvider: req.payload.oAuthProvider,
                            anonymousName,
                            avatarUrl: req.payload.avatarUrl || null,
                        })
                        .then(reply)
                        .catch(reply)
                },
            },
        },
        {
            method: 'GET',
            path: '/api/users/me',
            config: {
                description: 'Read user infos',
                tags: ['api'],
                handler(req, reply) {
                    cypherOne(`
                        MATCH (u:User { id: {id} })
                        RETURN u.id            AS id,
                               u.name          AS name,
                               u.anonymousName AS anonymousName,
                               u.avatarUrl     AS avatarUrl,
                               u.isAnonymous   AS isAnonymous`,
                        {
                            id: req.auth.credentials.id,
                        })
                        .then(reply)
                        .catch(reply)
                },
            },
        },
        {
            method: 'PUT',
            path: '/api/users/me',
            config: {
                description: 'Update user\'s infos',
                tags: ['api'],
                validate: {
                    payload: {
                        name: Joi.string(),
                        avatarUrl: Joi.string().uri({ scheme: 'https' }),
                        isAnonymous: Joi.boolean(),
                    },
                },
                handler(req, reply) {
                    cypherOne(`
                        MATCH (u:User { id: {userId} })
                        SET u.updatedAt   = timestamp(),
                            u.name        = {userName},
                            u.avatarUrl   = {userAvatarUrl}, 
                            u.isAnonymous = {userIsAnonymous}
                        RETURN u.id            AS id,
                               u.name          AS name,
                               u.anonymousName AS anonymousName,
                               u.avatarUrl     AS avatarUrl, 
                               u.isAnonymous   AS isAnonymous`,
                        {
                            userId: req.auth.credentials.id,
                            userName: req.payload.name,
                            userAvatarUrl: req.payload.avatarUrl || null,
                            userIsAnonymous: req.payload.isAnonymous,
                        })
                        .then(reply)
                        .catch(reply)
                },
            },
        },
        {
            method: 'GET',
            path: '/api/users/me/groups',
            config: {
                description: 'Read user\'s groups',
                tags: ['api'],
                handler(req, reply) {
                    cypher(`
                        MATCH    (:User { id:{id} })-[:IS_MEMBER_OF_GROUP { isAdmin: true, isActive: true }]->(g:Group)
                        MATCH    (u:User)-->(g)
                        RETURN   g.name      AS name, 
                                 g.avatarUrl AS avatarUrl, 
                                 g.id        AS id, 
                                 count(u.id) AS userCount
                        ORDER BY lower(g.name)`,
                        {
                            id: req.auth.credentials.id,
                        })
                        .then((groups) => _.map(groups, betterGroup))
                        .then(reply)
                        .catch(reply)
                },
            },
        },
    ])

    next()
}


exports.register.attributes = {
    name: 'users-route',
}
