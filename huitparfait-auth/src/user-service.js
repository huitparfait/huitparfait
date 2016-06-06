import Config from './infra/config'
import { sign } from './infra/jwt'
import request from 'request-promise'

const apiClient = request.defaults({ baseUrl: Config.get('proxy.apiUrl') })

export function findOrCreateUserByProfile(profile) {

    const anonymousJwt = sign({ anonymous: true }, '5s')

    const options = {
        json: profile,
        headers: {
            Authorization: `Bearer ${anonymousJwt}`,
        },
    }

    return apiClient.post('/api/users/me', options).then((result) => {
        return sign({
            id: result.id,
            name: result.name,
            anonymousName: result.anonymousName,
            avatarUrl: result.avatarUrl,
            isAnonymous: result.isAnonymous,
        })
    })
}
