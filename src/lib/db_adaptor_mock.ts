
//vendor
//import * as UID from 'uid-safe';

//app
import Logger from './logger';
const logger = Logger.getLogger();

import { MapWithIndexes, makeObjectNull } from './utils';
import { Constants } from './property_names';

import {
    //general
    AdaptorBase,
    ADAPTOR_STATE,
    AdaptorError,
    PropertiesModifyMessage,
    //user
    UsersAndPropsMessage,
    UserMessageBase,
    UserMessageReturned,
    UserPropertiesModifyMessageReturned,
    //tokens
    TokenMessage,
    TokensAndPropsMessage,
    TokenMessageReturned,
    TokenPropertiesModifyMessageReturned,
    //templates
    TemplatePropsMessage

} from './db_adaptor_base';

import {
    UserProperties,
    TokenProperties,
    TemplateProperties
} from './hermes_store';

import * as util from 'util';

export class AdaptorMock extends AdaptorBase {

    private static userPk = 333;

    private user: MapWithIndexes<UserProperties>;
    private token: MapWithIndexes<TokenProperties>;
    private template: MapWithIndexes<TemplateProperties>;

    private newUserPk(): number {
        do {
            AdaptorMock.userPk++; //bump
        }
        while (this.user.get('userId', AdaptorMock.userPk) !== undefined);
        return AdaptorMock.userPk;
    }

    private populateMaps() {
        //users
        let users: UserProperties[] = [
            { userId: 1, userName: 'Lucifer696', userEmail: 'vdingbats@gmail.com', userProps: {} },
            { userId: 7, userName: 'lucifer69c6', userEmail: 'vdwingbats@gmail.com', userProps: {} },
            { userId: 15, userName: 'anonymous', userEmail: '', userProps: {} },
            { userId: 18, userName: 'lucife696x', userEmail: 'change@me.lu', userProps: {} },
            { userId: 23, userName: 'jacobot', userEmail: 'email', userProps: {} }
        ];

        users.forEach((u) => {
            u.userName = u.userName.toLocaleLowerCase();
            u.userEmail = u.userEmail.toLocaleLowerCase();
            this.user.set(u);
        });

        // userProps
        let userProps = [
            { fk_user_id: 23, prop_name: 'LAST_NAME', prop_value: 'Bovors', invisible: false },
            { fk_user_id: 23, prop_name: 'AUTH', prop_value: 'admin', invisible: false },
            { fk_user_id: 23, prop_name: 'zipcode', prop_value: 'L1311', invisible: false },
            { fk_user_id: 1, prop_name: 'LAST_NAME', prop_value: 'Bovors', invisible: false },
            { fk_user_id: 1, prop_name: 'AUTH', prop_value: 'admin', invisible: false },
            { fk_user_id: 1, prop_name: 'phoneNr', prop_value: '+352621630973', invisible: true },
            { fk_user_id: 1, prop_name: 'blacklisted', prop_value: '', invisible: false },
            { fk_user_id: 1, prop_name: 'password', prop_value: 'itsme', invisible: false },
            { fk_user_id: 18, prop_name: 'password', prop_value: 'dingbats', invisible: false },
            { fk_user_id: 23, prop_name: 'password', prop_value: 'jacobot', invisible: false },
            //{ fk_user_id: 23, prop_name: 'no-acl', prop_value: 'tokenbladibla:0', invisible: false }
            //{ fk_user_id: 15, prop_name: 'await-activation', prop_value: 'tokenbladibla:0', invisible: false }
        ];

        userProps.forEach((up) => {
            let u = this.user.get('userId', up.fk_user_id);
            if (u) {
                up.prop_name = up.prop_name.toLocaleLowerCase();
                u.userProps[up.prop_name] = up.prop_value;
                this.user.set(u);
            }
        });


        let templates = [
            { id: 0, cookie_name: '', path: null, max_age: 86400000, http_only: null, secure: null, domain: null, same_site: null, rolling: null, template_name: 'default_token' },
            { id: 1, cookie_name: 'hermes.session', path: '/', max_age: 10800000, http_only: true, secure: false, domain: null, same_site: true, rolling: true, template_name: 'default_cookie' },
            { id: 3, cookie_name: 'hermes.session', path: '/', max_age: 10800000, http_only: true, secure: false, domain: null, same_site: true, rolling: true, template_name: 'secure_cookie' },
        ];

        templates.forEach((t) => {
            this.template.set({
                id: t.id,
                cookieName: t.cookie_name.toLocaleLowerCase(),
                path: t.path,
                maxAge: t.max_age,
                httpOnly: t.http_only,
                secure: t.secure,
                domain: t.domain,
                sameSite: t.same_site,
                rolling: t.rolling,
                templateName: t.template_name.toLocaleLowerCase()
            });

        });


    }


    public constructor() {
        super();
        this.user = new MapWithIndexes<UserProperties>('userId', 'userName', 'userEmail');
        this.token = new MapWithIndexes<TokenProperties>('tokenId');
        this.template = new MapWithIndexes<TemplateProperties>('id', 'templateName');
    }

    public init(): Promise<boolean> {

        if (!this.transition(ADAPTOR_STATE.Initializing)) {
            this.addErr('State cannot transition to [%s] from [%s]', ADAPTOR_STATE[ADAPTOR_STATE.Initializing], ADAPTOR_STATE[this.state]);
            logger.error(this.lastErr());
            return Promise.reject(false);
        }

        this.populateMaps();

        if (!this.transition(ADAPTOR_STATE.Initialized)) {
            this.addErr('Could not transition to [Initialized] state');
            this.transition(ADAPTOR_STATE.ERR_Initializing, true);
            logger.error(this.lastErr());
            return this.destroy(true);
        }
        logger.info('success loading all test data files');
        return Promise.resolve(true);

    }

    public get poolSize(): number {
        return 99; //dummy
    }

    public get connected(): boolean {
        return this.state === ADAPTOR_STATE.Initialized;
    }

    /* user */
    public userInsert(user: UserMessageBase): Promise<UserMessageReturned> {
        if (!this.connected) {
            return Promise.reject(new AdaptorError('Adaptor is in the wrong state:', this.state));
        }


        let u = Object.assign({}, user);
        makeObjectNull(u);

        logger.trace('Inserting user %j', u);

        return new Promise<UserMessageReturned>((resolve, reject) => {
            // username is unique
            let conflict = this.user.get('userName', u.userName);
            if (conflict) {
                return reject(new AdaptorError(
                    util.format('unique key violation, [userName] already exist: %s', u.userName),
                    this.state)
                );
            }
            //email is unique
            conflict = this.user.get('userEmail', u.userEmail);
            if (conflict) {
                return reject(new AdaptorError(
                    util.format('unique key violation, [userEmail] already exist: %s', u.userName),
                    this.state)
                );
            }
            console.info('creating new user...');
            let msg: UserMessageReturned = {
                userEmail: user.userEmail,
                userName: user.userName,
                userId: this.newUserPk(),
            };
            let newUser: UserProperties = {
                ...msg,
                userProps: {}
            };
            this.user.set(newUser);
            logger.info('success: "creating user", returned values %j', msg);
            delete newUser.userProps;
            return resolve(msg);
        });
    }


    public userInsertModifyProperty(userId: number, modifications: PropertiesModifyMessage[]): Promise<UserPropertiesModifyMessageReturned[]> {
        if (!this.connected) {
            return Promise.reject(new AdaptorError('Adaptor is in the wrong state:', this.state));
        }

        logger.trace('user  %s props modification list %j', userId, modifications);

        //check 1 user must exist
        return new Promise<UserPropertiesModifyMessageReturned[]>((resolve, reject) => {
            let u = this.user.get('userId', userId);
            if (!u) {
                return reject(new AdaptorError(
                    util.format('foreign key violation, [userId] does not exist: %d', userId),
                    this.state)
                );
            }
            let rc: UserPropertiesModifyMessageReturned[] = [];
            let uc = <UserProperties>u;

            for (let mod of modifications) {
                //switch is just for logging/tracing
                switch (true) {
                    case mod.invisible:
                        logger.trace('user:%d, DELETE property %s', uc.userId, mod.propName);
                        break;
                    case !(mod.propName in uc.userProps):
                        logger.trace('user:%d, NEW property %s, value %s', uc.userId, mod.propName, mod.propValue);
                        break;
                    case (uc.userProps[mod.propName] !== mod.propValue):
                        logger.trace('user:%d, MODIFY property %s, NEW value: %s, OLD value: %s',
                            uc.userId, mod.propName, mod.propValue, uc.userProps[mod.propName]);
                        break;
                    default:
                }
                rc.push({
                    fkUserId: uc.userId,
                    propName: mod.propName,
                    propValue: mod.propValue,
                    invisible: mod.invisible
                });
                if (mod.invisible) {
                    delete uc.userProps[mod.propName];
                    continue;
                }
                uc.userProps[mod.propName] = mod.propValue;
            }
            return resolve(rc);
        });
    }


    public userSelectByFilter(): Promise<UsersAndPropsMessage[]> {

        if (!this.connected) {
            return Promise.reject(new AdaptorError('Adaptor is in the wrong state:', this.state));
        }
        return new Promise<UsersAndPropsMessage[]>((resolve) => {

            //flatten users and props
            let rc = this.user.values().reduce((prev, user) => {
                let propKeys = Object.getOwnPropertyNames(user.userProps);
                do {
                    let pKey = propKeys.pop();
                    let pValue = pKey && user.userProps[pKey];
                    prev.push({
                        userId: user.userId,
                        userName: user.userName,
                        userEmail: user.userEmail,
                        propName: pKey,
                        propValue: pValue
                    } as UsersAndPropsMessage);
                } while (propKeys.length);
                return prev;
            }, [] as UsersAndPropsMessage[]);
            logger.trace('[selectUserProps]success: rows fetched %d', rc.length);
            resolve(rc);
        });
    }


    /*tokens*/
    /*tokens*/
    /*tokens*/

    public tokenInsertModify(token: TokenMessage): Promise<TokenMessageReturned> {

        if (!this.connected) {
            return Promise.reject(new AdaptorError('Adaptor is in the wrong state:', this.state));
        }

        //let uid = UID.sync(18);

        let t = Object.assign({}, this.token.get('tokenId', token.tokenId), token) as TokenProperties;
        if (!t.sessionProps) {
            t.sessionProps = {};
        }
        makeObjectNull(t);
        //t.tokenId = t.tokenId; // || uid;

        let self = this;

        return new Promise<TokenMessageReturned>(function asyncTokenInsertModify(resolve, reject) {
            //determine template
            t.templateName = token.templateName || 'default_token'; //is it is defaulted in the sql query
            let template = self.template.get('templateName', t.templateName);
            if (template === undefined) {
                return reject(new AdaptorError(
                    util.format('could not find template [%s]', t.templateName),
                    self.state
                ));
            }
            //create-update tokenProperties
            self.token.set(t); // a copy is saved!! not a reference to 't'
            //return value is the same less for sessionprops stripped off
            logger.debug('success: "created/updated token": %j', t);
            return resolve({
                tokenId: t.tokenId,
                fkUserId: t.fkUserId,
                purpose: t.purpose,
                ipAddr: t.ipAddr,
                tsIssuance: t.tsIssuance,
                tsRevoked: t.tsRevoked,
                revokeReason: t.revokeReason,
                tsExpire: t.tsExpire,
                tsExpireCache: t.tsExpire,
                templateId: template.id
            });
        });
    }

    public tokenInsertModifyProperty(tokenId: string, modifications: PropertiesModifyMessage[]): Promise<TokenPropertiesModifyMessageReturned[]> {

        if (!this.connected) {
            return Promise.reject(new AdaptorError('Adaptor is in the wrong state:', this.state));
        }
        logger.trace('token  %s props modification list %j', tokenId, modifications);

        return new Promise<TokenPropertiesModifyMessageReturned[]>((resolve, reject) => {
            //check 1 user must exist
            let t = this.token.get('tokenId', tokenId);
            if (!t) {
                return reject(new AdaptorError(
                    util.format('foreign key violation, [tokenId] does not exist: %d', tokenId),
                    this.state)
                );
            }
            let rc: TokenPropertiesModifyMessageReturned[] = [];
            let tc = <TokenProperties>t;

            for (let mod of modifications) {
                //switch is just for logging/tracing
                switch (true) {
                    case mod.invisible:
                        logger.trace('token:%d, DELETE property %s', tc.tokenId, mod.propName);
                        break;
                    case !(mod.propName in tc.sessionProps):
                        logger.trace('token:%d, NEW property %s, value %s', tc.tokenId, mod.propName, mod.propValue);
                        break;
                    case (tc.sessionProps[mod.propName] !== mod.propValue):
                        logger.trace('token:%d, MODIFY property %s, NEW value: %s, OLD value: %s',
                            tc.tokenId, mod.propName, mod.propValue, tc.sessionProps[mod.propName]);
                        break;
                    default:
                }
                rc.push({
                    propName: mod.propName,
                    propValue: mod.propValue,
                    invisible: mod.invisible,
                    fkTokenId: tokenId
                });
                if (mod.invisible) {
                    delete tc.sessionProps[mod.propName];
                    continue;
                }
                tc.sessionProps[mod.propName] = mod.propValue;
            }
            return resolve(rc);
        });
    }

    public tokenAssociateWithUser(tokenId: string, userId: number): Promise<boolean> {

        logger.trace('assoiate token %s with user %d', tokenId, userId);

        if (!this.connected) {
            return Promise.reject(new AdaptorError('Adaptor is in the wrong state:', this.state));
        }

        let t = this.token.get('tokenId', tokenId);
        if (t) {
            let u = this.user.get('userId', userId);
            if (!u) {
                return Promise.reject(new AdaptorError(
                    util.format('User with Id: %d doesnt exist!', userId),
                    this.state
                ));
            }
            t.fkUserId = u.userId;
            this.token.set(t);
        }
        return Promise.resolve(true); //
    }


    public tokenDoRevoke(tokenId: string, revokeReason: string, revokeTime?: number | null): Promise<boolean> {

        logger.trace('Expire token %s with reason %s', tokenId, revokeReason);

        if (!this.connected) {
            return Promise.reject(new AdaptorError('Adaptor is in the wrong state:', this.state));
        }

        if (!revokeTime) {
            revokeTime = Date.now();
        }
        //
        //token exist?
        //
        let t = this.token.get('tokenId', tokenId);
        if (t) {
            t.revokeReason = revokeReason;
            t.tsRevoked = revokeTime;
            this.token.set(t);
        }
        return Promise.resolve(true);
    }

    public tokenGC(deleteOlderThen: number): Promise<number> {

        if (!this.connected) {
            return Promise.reject(new AdaptorError('Adaptor is in the wrong state:', this.state));
        }

        let allTokens = this.token.values();
        let rc = allTokens.filter((token) => token.tsRevoked && token.tsRevoked < deleteOlderThen);
        rc.forEach((token) => this.token.remove(token));
        return Promise.resolve(rc.length);
    }

    private getTokensByFilter(filter: (token: TokenProperties) => boolean): TokensAndPropsMessage[] {
        let result: TokensAndPropsMessage[] = [];

        this.token.values().filter(filter).reduce((prev, token) => {
            let u = <UserProperties>this.user.get('userId', <number>token.fkUserId);
            let uPropKeys = Object.getOwnPropertyNames(u.userProps);
            let tPropKeys = Object.getOwnPropertyNames(token.sessionProps);

            let blacklisted: Constants = 'blacklisted';

            let blackListed = uPropKeys.indexOf(blacklisted) >= 0;
            while (uPropKeys.length || tPropKeys.length) {
                let uPropName = uPropKeys.pop();
                let tPropName = tPropKeys.pop();
                prev.push({
                    tokenId: token.tokenId,
                    fkUserId: u.userId,
                    usrName: u.userName,
                    usrEmail: u.userEmail,
                    blackListed: blackListed,
                    purpose: token.purpose,
                    ipAddr: token.ipAddr,
                    tsIssuance: token.tsIssuance,
                    tsRevoked: token.tsRevoked,
                    tsExpire: token.tsExpire,
                    tsExpireCache: token.tsExpire,
                    revokeReason: token.revokeReason,
                    templateName: token.templateName,
                    sessionPropName: tPropName || null,
                    sessionPropValue: (tPropName && token.sessionProps[tPropName]) || null,
                    propName: uPropName || null,
                    propValue: uPropName && u.userProps[uPropName] || null
                });

            }
            return prev;
        }, result);
        return result;

    }

    public tokenSelectAllByFilter(
        timestampExpire: number | null,
        startTimestampRevoked: number,
        endTimestampRevoked: number): Promise<TokensAndPropsMessage[]> {

        if (!this.connected) {
            return Promise.reject(new AdaptorError('Adaptor is in the wrong state:', this.state));
        }

        let result = this.getTokensByFilter((token) => {
            let rc = !timestampExpire || token.tsExpire > timestampExpire;
            let tsrevoked = token.tsRevoked || 0;
            rc = rc && (tsrevoked >= startTimestampRevoked && tsrevoked <= endTimestampRevoked);
            return rc;
        });
        return Promise.resolve(result);
    }

    public tokenSelectAllByUserIdOrName(userId: number | null, userName: string | null): Promise<TokensAndPropsMessage[]> {

        if (!this.connected) {
            return Promise.reject(new AdaptorError('Adaptor is not connected', this.state));
        }

        if ((userId === null && userName === null) || (userId !== null && userName !== null)) {
            return Promise.reject(new AdaptorError('wrong input, userId and userName cannot be both non null or both null.', this.state));
        }

        let result = this.getTokensByFilter((token) => {
            let rc = false;
            if (userId) {
                rc = token.fkUserId === userId;
            }
            if (userName) {
                let u = this.user.get('userName', userName);
                if (u) {
                    rc = token.fkUserId === u.userId;
                }
            }
            return rc;
        });
        return Promise.resolve(result);
    }

    /* templates */
    public templateSelectAll(): Promise<TemplatePropsMessage[]> {
        if (!this.connected) {
            this.addErr('Adaptor is not connected');
            return Promise.reject(this.lastErr());
        }

        let result = this.template.values().map((temp) => {
            let rc: TemplatePropsMessage = {
                id: temp.id,
                cookieName: temp.cookieName,
                path: temp.path,
                maxAge: temp.maxAge,
                httpOnly: temp.httpOnly,
                secure: temp.secure,
                domain: temp.domain,
                sameSite: temp.sameSite,
                rolling: temp.rolling,
                templateName: temp.templateName
            };
            return rc;
        });
        return Promise.resolve(result);
    }
}
