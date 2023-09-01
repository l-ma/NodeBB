import url from 'url';

import { Request, Response, NextFunction } from 'express';
import plugins from '../plugins';
import meta from '../meta';
import user from '../user';
import { SettingsObject } from '../types';

type Configr = {
    homePageRoute: string,
    homePageCustom: string,
    allowUserHomePage: string
}

export function adminHomePageRoute(): string {
    const con: Configr = meta.config as Configr;
    return ((con.homePageRoute === 'custom' ? con.homePageCustom : con.homePageRoute) || 'categories').replace(/^\//, '');
}

export async function getUserHomeRoute(uid: number): Promise<string> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const settings: SettingsObject = await user.getSettings(uid) as SettingsObject;
    let route: string = adminHomePageRoute();

    if (settings.homePageRoute !== 'undefined' && settings.homePageRoute !== 'none') {
        route = (settings.homePageRoute || route).replace(/^\/+/, '');
    }

    return route;
}

type ComposerData = {
    req: Request<object, object, ComposerData>,
    uid: number,
    timestamp: number,
    content: string,
    fromQueue: boolean,
    tid?: number,
    cid?: number,
    title?: string,
    tags?: string[],
    thumb?: string,
    noscript?: string
}

export async function rewrite(req: Request<object, object,
    ComposerData> & { uid: number }, res: Response<object, Locals>, next: NextFunction): Promise<void> {
    if (req.path !== '/' && req.path !== '/api/' && req.path !== '/api') {
        return next();
    }
    let route = adminHomePageRoute();
    const con: Configr = meta.config as Configr;
    if (con.allowUserHomePage) {
        route = await getUserHomeRoute(req.uid);
    }

    let parsedUrl: url.UrlWithParsedQuery;
    try {
        parsedUrl = url.parse(route, true);
    } catch (err) {
        return next(err);
    }

    const { pathname } = parsedUrl;
    const hook = `action:homepage.get:${pathname}`;
    if (!plugins.hooks.hasListeners(hook)) {
        req.url = req.path + (!req.path.endsWith('/') ? '/' : '') + pathname;
    } else {
        res.locals.homePageRoute = pathname;
    }
    req.query = Object.assign(parsedUrl.query, req.query);

    next();
}

type NewType = object;

type Locals = {
    homePageRoute: string;
}

export async function pluginHook(req: Request, res: Response<NewType, Locals>, next: NextFunction) {
    const hook = `action:homepage.get:${res.locals.homePageRoute}`;

    await plugins.hooks.fire(hook, {
        req: req,
        res: res,
        next: next,
    });
}
