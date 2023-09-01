import url from 'url';

import { Request, Response, NextFunction } from 'express';
import plugins from '../plugins';
import meta from '../meta';
import user from '../user';
import { SettingsObject } from '../types';

type Configr = {
    homePageRoute: string,
    homePageCustom: string
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

////

async function rewrite(req, res, next) {
    if (req.path !== '/' && req.path !== '/api/' && req.path !== '/api') {
        return next();
    }
    let route = adminHomePageRoute();
    if (meta.config.allowUserHomePage) {
        route = await getUserHomeRoute(req.uid);
    }

    let parsedUrl;
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

exports.rewrite = rewrite;

function pluginHook(req, res, next) {
    const hook = `action:homepage.get:${res.locals.homePageRoute}`;

    plugins.hooks.fire(hook, {
        req: req,
        res: res,
        next: next,
    });
}

exports.pluginHook = pluginHook;
