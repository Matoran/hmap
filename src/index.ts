import { HMap } from './hmap';
import { Toast } from './toast';
import { Environment } from './environment';
import { HMapDesertData } from './data/hmap-desert-data';
import { HMapRuinData } from './data/hmap-ruin-data';
import { Log } from './log';

declare const HMAP_DEVMODE: boolean;
declare let HMAP: any;
declare let HMAPDESERTDATA: any;
declare let HMAPRUINDATA: any;
declare let LOCAL_FONTFACEOBSERVER: any;
declare let ENVIRONMENT: any;

// deal with the "require" nighmare
let FontFaceObserver: any;
if (typeof require != 'undefined') {
    FontFaceObserver = require('fontfaceobserver-es');
} else if (typeof LOCAL_FONTFACEOBSERVER != 'undefined') {
    FontFaceObserver = LOCAL_FONTFACEOBSERVER;
} else {
    console.error('HMap::bootstrap', 'Cannot load fontface observer');
}

/**
 * It's bootstrap time !!
 */
(function() {
    const logger = Log.get('BOOTSTRAP');
    try {
        const env = Environment.getInstance();
        env.devMode = (typeof HMAP_DEVMODE === 'undefined') ? false : (HMAP_DEVMODE) ? true : false;
        logger.log('Devmode', env.devMode);
        // Create the styles for the fonts and some other styles
        const style = document.createElement('style');
        style.appendChild(document.createTextNode('\
        @font-face {\
            font-family: visitor2;\
            src: url(\'' + env.url + '/visitor2.woff2\') format(\'woff2\');\
			src: url(\'' + env.url + '/visitor2.woff\') format(\'woff\');\
        }\
        @font-face {\
            font-family: economica;\
            src: url(\'' + env.url + '/economica.woff2\') format(\'woff2\');\
        }\
        div.hmap-button {\
            padding:0px 5px;\
            margin:2px 5px;\
            border:1px solid black;\
            background-color: #a13119;\
            font-size:13px;\
            font-weight:700;\
            font-family:economica;\
            color:#eccb94;\
            cursor:pointer;\
            display:flex;\
            align-items:center;\
            user-select:none;\
        }\
        .hmap-popup {\
            font-smooth: none;\
            -webkit-font-smoothing: none;\
        }\
        .hmap-text-green {\
            font-smooth: none;\
            -webkit-font-smoothing: none;\
            fill: #d7ff5b;\
            font-family: visitor2;\
            font-size: 13px;\
        }\
        .hmap-text-yellow {\
            font-smooth: none;\
            -webkit-font-smoothing: none;\
            fill: #ebc369;\
            font-family: visitor2;\
            font-size: 13px;\
        }\
        '));
        document.head.appendChild(style);

        // create fake content to load the fonts ( ... )
        const body = document.querySelector('body')!; // pretty sure body is there
        const divVisitor2 = document.createElement('div');
        divVisitor2.setAttribute('style', 'font-family:visitor2;display:none;');
        body.appendChild(divVisitor2);
        const divEconomica = document.createElement('div');
        divEconomica.setAttribute('style', 'font-family:economica;display:none;');
        body.appendChild(divEconomica);

        const visitor2 = new FontFaceObserver('visitor2');
        const economica = new FontFaceObserver('economica');

        // load the fonts
        Promise.all([visitor2.load(), economica.load()]).then(function () {
            try {
                // start only when the fonts are loaded
                const map = new HMap();
                if (env.devMode === true) { // dev mode to play with the map
                    logger.log('Devmode started with location = desert');
                    map.location = 'desert';
                    map.reloadMapWithData();
                    HMAP = map;
                    HMAPDESERTDATA = HMapDesertData;
                    HMAPRUINDATA = HMapRuinData;
                    ENVIRONMENT = Environment;
                } else {
                    // wait for js.JsMap to be ready
                    logger.log('wait for js.JsMap to be ready');
                    let counterCheckJsMap = 0; // count the number of tries
                    const checkLocationKnown = setInterval(function() {
                        if (map.getCurrentLocation() !== 'unknown') { // when we land on a page with the map already there, start the code
                            clearInterval(checkLocationKnown);
                            logger.log('Look for location (doors, desert or ruin)');
                            map.location = map.getCurrentLocation();
                            logger.log('Location found : ', map.location);
                            logger.log('Stop looking for the map and fetch data');
                            map.fetchMapData(); // intercept every ajax request haxe is doing to know if we should start the map or not
                            logger.log('Datafetch, setup the interceptor');
                            setTimeout(() => map.setupInterceptor());
                        } else if (++counterCheckJsMap > 10) { // timeout 2s
                            clearInterval(checkLocationKnown);
                            logger.log('Timeout looking for the map, nothing has been found');
                            logger.log('Setup the interceptor, to start the map when flash data are detected');
                            map.setupInterceptor(); // intercept every ajax request haxe is doing to know if we should start the map or not
                        }
                    }, 200);
                }
            } catch (err) {
                logger.error('HMap::bootstrap - loaded', err, err.message);
                Toast.show('Hmap - An error occured. Check the console to see the message.');
            }
        }).catch((err) => {
            logger.error('HMap::promiseAll', err, err.message);
            Toast.show('Hmap - Cannot load the fonts. Try to reload the page by pressing CTRL + F5 or change your browser');
        });

    } catch (err) {
        logger.error('HMap::bootstrap', err, err.message);
        Toast.show('Hmap - An error occured. Check the console to see the message.');
    }
})();
