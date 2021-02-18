import { HMapRandom } from '../random';
import { AbstractHMapLayer } from './abstract';
import { HMapGridMap } from '../maps/grid';
import { HMapLang, HMapTraduction } from '../lang';
import { HMapDesertDataJSON, HMapDesertLocalDataJSON, HMapDesertData } from '../data/hmap-desert-data';

/**
 * This layer will hold the grid view
 */
export class HMapSVGGridLayer extends AbstractHMapLayer<HMapDesertDataJSON, HMapDesertLocalDataJSON> {

    private spaceBetweenSquares = 1;
    private squareSize?: number;
    private padding?: number;

    private isPanning = false;
    private startPoint = {x: 0 , y: 0};
    private endPoint = {x: 0, y: 0};
    private scale = 1;
    private viewBox = {x : 0, y : 0, w : 0, h : 0};

    constructor(map: HMapGridMap) {
        super(map);

        const hmap = document.querySelector('#hmap') as HTMLElement;
        if (document.querySelector('#svgGrid') === null && hmap) {
            const SVG = document.createElementNS(this.ns, 'svg');
            SVG.setAttributeNS(null, 'id', 'svgGrid');
            SVG.setAttributeNS(null, 'style', 'position:absolute;z-index:2;');
            hmap.appendChild(SVG);
            hmap.style.backgroundColor = '#2b3a08';
        }
        this.svg = document.getElementById('svgGrid') as HTMLObjectElement;
        this.svg.setAttributeNS(null, 'width', map.width  + 'px');
        this.svg.setAttributeNS(null, 'height', map.height  + 'px');
        this.svg.style.width = map.width + 'px';
        this.svg.style.height = map.height + 'px';

        this.attachPanZoomEvents();

        this.type = 'grid';
    }

    draw() {
        const oldGroup = this.g;
        this.g = document.createElementNS(this.ns, 'g');

        const mapData = this.map.mapData as HMapDesertData;
        const map = this.map as HMapGridMap;
        const minWidthHeight = Math.min(map.width, map.height);
        const availableSize = minWidthHeight - 25 - this.spaceBetweenSquares * mapData.size.height;
        this.squareSize = Math.floor(availableSize / mapData.size.height);
        this.padding = Math.floor((minWidthHeight - this.spaceBetweenSquares * mapData.size.height - this.squareSize * mapData.size.height) / 2);
        const soulsData = [];

        for (let i = 0, j = mapData.details.length; i < j; i++) {
            const position = mapData.getCoordinates(i);
            const currentPos = (position.y === mapData.position.y && position.x === mapData.position.x); // position is current positon

            const x = this.padding + position.x * (this.squareSize + this.spaceBetweenSquares);
            const y = this.padding / 2 + position.y * (this.squareSize + this.spaceBetweenSquares);

            if (mapData.details[i] === undefined || mapData.details[i] === null) {
                mapData.details[i] = {
                    _z: 0,
                    _c: 0,
                    _s: false,
                    _nvt: 1,
                    _t: 0
                };
            }

            // color or hatch the position
            let visionArray = mapData.global;
            if (map.mode === 'personal') {
                visionArray = mapData.view;
            }

            // color the case
            let fillColor = '#475613'; // default background color
            let strokeColor;
            if ( currentPos ) {
                strokeColor = '#d8fe6e';
            }

            if (mapData.details[i]._z > 9) {
                fillColor = '#8f340b';
            } else if (mapData.details[i]._z > 5) {
                fillColor = '#8f7324';
            } else if (mapData.details[i]._z > 0) {
                fillColor = '#8f990b';
            } else {
                fillColor = '#475613';
            }
            const square = this.rect(x, y, this.squareSize, this.squareSize, fillColor, strokeColor);
            square.setAttributeNS(null, 'index', i + '');
            if (currentPos) {
                square.setAttributeNS(null, 'current', 'true');
            }

            square.onmouseenter = this.onMouseEnterSquare.bind(this);
            square.onmouseleave = this.onMouseLeaveSquare.bind(this);
            square.onmouseup = this.onMouseUpSquare.bind(this);

            if (visionArray[i] !== undefined && visionArray[i] !== null && visionArray[i]! >= -1 ) {

                if (mapData.details[i]._nvt === true) { // outside of tower range
                    this.imgFromObj('hatch', x, y, undefined, undefined, this.squareSize, this.squareSize);
                } else if (mapData.details[i]._nvt === false) { // inside of tower range
                    // apparently nothing to do in this case, but I'm not sure so I let the if
                } else {
                    throw new Error('HMapGridLayer::draw - as far as I understand, we cannot be in this case');
                }

            } else { // position never visited
                this.imgFromObj('hatch-dense', x, y, undefined, undefined, this.squareSize, this.squareSize);
            }

            if (mapData.details[i]._c > 0 || mapData.details[i]._c === -1) { // another building than town
                if (mapData.details[i]._c === 1) { // town
                    this.imgFromObj('town', x, y, undefined, undefined, this.squareSize, this.squareSize);
                } else {
                    this.imgFromObj('building', x, y, undefined, undefined, this.squareSize, this.squareSize);
                }
            }

            // place the users
            if (mapData.details[i]._c !== 1 ) {
                const users = mapData.users.get(i);
                if (users !== undefined) {
                    users.forEach(user => {
                        let usernameAsNumber = 0; // for seeding purposes
                        for (let k = 0; k < user._n.length; k++) {
                            usernameAsNumber += user._n.charCodeAt(k);
                        }
                        const seed = (x * 10 + y) * ( y * 10 + x) + usernameAsNumber;
                        const random = new HMapRandom(seed);

                        const userImg = this.imgFromObj(
                            'people',
                            x + random.getRandomIntegerLocalSeed(0.2 * this.squareSize!, 0.8 * this.squareSize!),
                            y + random.getRandomIntegerLocalSeed(0.2 * this.squareSize!, 0.8 * this.squareSize!)
                        );
                        userImg.setAttributeNS(null, 'class', 'hmap-user');
                    });
                }
            }

            // There is a soul on the position
            if(mapData.details[i]._s) {
                // Points for the path to move the soul
                // We add 4 points that are current position, left position, top position and top-left position
                // Like on the flash version
                const points = [
                    {
                        x: x + (this.squareSize),
                        y: y + (this.squareSize)
                    },
                    {
                        x: x - this.squareSize,
                        y: y + this.squareSize
                    },
                    {
                        x: x + this.squareSize,
                        y: y - this.squareSize
                    },
                    {
                        x: x - this.squareSize,
                        y: y - this.squareSize
                    }
                ];
                for(let ipoint = 0 ; ipoint < 2 ; ipoint++){
                    points.push({
                        x: HMapRandom.getRandomIntegerNoSeed(x - this.squareSize, x + this.squareSize),
                        y: y - this.squareSize
                    });
                }
                for(let ipoint = 0 ; ipoint < 2 ; ipoint++){
                    points.push({
                        x: HMapRandom.getRandomIntegerNoSeed(x - this.squareSize, x + this.squareSize),
                        y: y + this.squareSize
                    });
                }
                for(let ipoint = 0 ; ipoint < 2 ; ipoint++){
                    points.push({
                        x: x + this.squareSize,
                        y: HMapRandom.getRandomIntegerNoSeed(y - this.squareSize, y + this.squareSize)
                    });
                }
                for(let ipoint = 0 ; ipoint < 2 ; ipoint++){
                    points.push({
                        x: x - this.squareSize,
                        y: HMapRandom.getRandomIntegerNoSeed(y - this.squareSize, y + this.squareSize)
                    });
                }
                let pathString = 'M ';
                const origLength = points.length;
                for(let ipoint = 0 ; ipoint < origLength ; ipoint++){
                    const point = points.splice(HMapRandom.getRandomIntegerNoSeed(0, points.length), 1)[0];
                    pathString += point.x + ' ' + point.y;
                    if(ipoint < origLength - 1) {
                        pathString += ' L ';
                    }
                }

                pathString += ' Z';
                soulsData.push({
                    path: pathString,
                    soul: {
                        x: x,
                        y: y
                    }
                });
            }

            // display tags
            if (map.displayTags) {
                const tag = mapData.details[i]._t;
                if ( tag > 0 && tag < 13) {
                    const tagSize = Math.min(this.squareSize / 1.5, 16);

                    const tagImg = this.imgFromObj(
                        'tag_' + tag,
                        x + this.squareSize / 2 - tagSize / 2,
                        y + this.squareSize / 2 - tagSize / 2,
                        undefined,
                        undefined,
                        tagSize,
                        tagSize);
                    tagImg.setAttributeNS(null, 'class', 'hmap-tag');
                }
            }

            // draw the target
            if ( mapData.details[i]._c !== 1 &&
                        !currentPos &&
                        position.x === map.target.x &&
                        position.y === map.target.y) { // not town && target && not current pos
                const target = this.imgFromObj('target', x, y, undefined, undefined, this.squareSize, this.squareSize);
                target.setAttributeNS(null, 'class', 'hmap-target');
            }
        } // iterate over the grid

        // Iterate through all the souls we must display
        // We do it at the end so the images are above everything in the grid
        for(let i = 0 ; i < soulsData.length ; i++){
            const pathString = soulsData[i].path;
            const path = this.path(pathString);
            path.setAttributeNS(null, 'style', 'fill: none');
            path.setAttributeNS(null, 'class', 'hmap-soul-path');
            const imgsoul = this.imgFromObj(
                'tag_12',
                soulsData[i].soul.x,
                soulsData[i].soul.y,
                undefined,
                undefined,
                this.squareSize,
                this.squareSize
            );
            imgsoul.setAttributeNS(null, 'class', 'hmap-soul');
        }

        this.svg.appendChild(this.g);
        if (oldGroup) {
            window.setTimeout(() => this.svg.removeChild(oldGroup), 100);
        }

        // Creating JS client-side to move the souls' images
        const script = document.createElement('script');
        script.setAttributeNS(null, 'type', 'application/javascript');
        script.setAttributeNS(null, 'id', 'moveSoulScript');
        script.textContent = 'var counter = 0;' +
        'var direction = true;' + // Sens of the movment
        'var svgContainer = document.getElementById("hmap");' + // Reference to the enclosing div
        'var ns = "http://www.w3.org/2000/svg";' +
        'var souls = svgContainer.getElementsByClassName("hmap-soul");' + // List of all the souls images
        'function moveSoul() {' +
            // Check to see where the souls are journeys to determine
            // if they arrived at the end
            'if (parseInt(counter,10) === 1) {' +
                // we've hit the end! +
                'direction = false;' +
            '} else if (parseInt(counter,10) < 0) {' +
                'direction = true;' +
            '}' +
            // Moving toward the path
            'if(direction) {' +
                'counter += 0.0005;' +
            '} else {' +
                'counter -= 0.0005;' +
            '}' +
            /* Now the magic part. We are able to call .getPointAtLength on the paths to return
            the coordinates at any point along their lengths. We then simply set the souls to be positioned
            at these coordinates, incrementing along the lengths of the paths */
            'for(var i = 0 ; i < souls.length ; i++){' +
                // We get the new X and Y for the transformation property
                'var path = souls[i].previousSibling;' +
                'var pathLength = path.getTotalLength();' +
                // The transformation is relative to the original point
                'var newX = path.getPointAtLength(counter * pathLength).x;' +
                'var newY = path.getPointAtLength(counter * pathLength).y;' +
                'var transfX = parseFloat(newX - souls[i].getAttribute("x") - ' + (this.squareSize / 2) + ');' +
                'var transfY = parseFloat(newY - souls[i].getAttribute("y") - ' + (this.squareSize / 2) + ');' +
                // Now the best part : we try to rotate the image according to the movement
                'var oldTransf = souls[i].getAttribute("transform");' +
                'var oldX = parseInt(souls[i].getAttribute("x"));' +
                'var oldY = parseInt(souls[i].getAttribute("y"));' +
                'if (oldTransf != null) {' +
                    'var regex = /translate\\(([0-9-.]+),([0-9-.]+)\\)/;' +
                    'if (oldTransf.match(regex) != null && oldTransf.match(regex).length > 1) { ' +
                        'oldX += parseFloat(oldTransf.match(regex)[1]);' +
                        'oldY += parseFloat(oldTransf.match(regex)[2]);' +
                    '}' +
                '}' +
                'var h = Math.sqrt(Math.pow(newX - oldX, 2) + Math.pow(newY - oldY, 2));' +
                'var c = Math.abs(newX - oldX);' +
                'var a = Math.acos(c / h) * 180 / Math.PI;' +
                'var soulx = parseInt(souls[i].getAttribute("x"));' +
                'var souly = parseInt(souls[i].getAttribute("y"));' +
                'souls[i].setAttribute("transform", "' +
                'translate("+ transfX  + "," + transfY + ") ' +
                'rotate(" + a + " " + (soulx + ' + (this.squareSize / 2) + ') + " " + (souly + ' + (this.squareSize / 2) + ') + ")");' +
            '}' +
            'requestAnimationFrame(moveSoul);' +
        '}' +
        'if (souls.length > 0) {' +
            'requestAnimationFrame(moveSoul);' +
        '}';
        document.getElementsByTagName('body')[0].appendChild(script);
        document.getElementsByTagName('body')[0].removeChild(script);
    }

    /**
     * Reset the zoom & pan level
     */
    resetView() {
        const width = this.map.width;
        const height = this.map.height;
        this.viewBox = {x : 0, y : 0, w : width, h : height};
        this.isPanning = false;
        this.startPoint = {x: 0 , y: 0};
        this.endPoint = {x: 0, y: 0};
        this.scale = 1;
        this.svg.setAttributeNS(null, 'viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`);

    }

    private onMouseEnterSquare(e: MouseEvent) {
        if (this.isPanning) {
            return;
        }
        const rect = e.target as HTMLObjectElement;
        const index = (rect.getAttributeNS(null, 'index') !== null) ? +rect.getAttributeNS(null, 'index')! : undefined ;
        if (index !== undefined && this.squareSize && this.padding) {
            const mapData = this.map.mapData as HMapDesertData;
            const position = mapData.getCoordinates(index);
            const x = this.padding + position.x * (this.squareSize + this.spaceBetweenSquares);
            const y = this.padding / 2 + position.y * (this.squareSize + this.spaceBetweenSquares);

            if (rect.getAttributeNS(null, 'current') !== 'true') {
                rect.setAttributeNS(null, 'stroke', '#d8fe6e');
                rect.setAttributeNS(null, 'stroke-width', '2');
            }
            this.drawPopup(x, y, index);
        }
    }

    private onMouseLeaveSquare(e: MouseEvent) {
        if (this.isPanning) {
            return;
        }
        const rect = e.target as HTMLObjectElement;
        if (rect.getAttributeNS(null, 'current') !== 'true') {
            rect.setAttributeNS(null, 'stroke', '');
            rect.setAttributeNS(null, 'stroke-width', '0');
        }
        // remove the popup elements
        document.querySelectorAll('.hmap-popup').forEach(elementToRemove => elementToRemove.remove() );
    }

    private onMouseUpSquare(e: MouseEvent) {
        if (this.startPoint.x !== this.endPoint.x || this.startPoint.y !== this.endPoint.y) {
            return; // panning situation. leave
        }

        const map = this.map as HMapGridMap;
        const rect = e.target as HTMLObjectElement;
        const index = (rect.getAttributeNS(null, 'index') !== null) ? +rect.getAttributeNS(null, 'index')! : undefined ;

        // remove the current target
        document.querySelectorAll('.hmap-target').forEach(elementToRemove => elementToRemove.remove() );

        // create new target
        if (index !== undefined && this.squareSize && this.padding) {
            const mapData = this.map.mapData as HMapDesertData;
            const position = mapData.getCoordinates(index);
            const x = this.padding + position.x * (this.squareSize + this.spaceBetweenSquares);
            const y = this.padding / 2 + position.y * (this.squareSize + this.spaceBetweenSquares);

            map.setTarget(mapData.getCoordinates(index));
            const target = this.imgFromObj('target', x, y, undefined, undefined, this.squareSize, this.squareSize);
            target.setAttributeNS(null, 'class', 'hmap-target');
        }
    }

    /**
     * Enable the zoom and pan behavior
     */
    private attachPanZoomEvents() {
        const svgContainer = document.querySelector('#hmap')! as HTMLElement;

        this.viewBox = {x : 0, y : 0, w : this.map.width, h : this.map.height};
        this.svg.setAttributeNS(null, 'viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`);
        this.isPanning = false;
        this.startPoint = {x: 0 , y: 0};
        this.endPoint = {x: 0, y: 0};
        this.scale = 1;

        svgContainer.onwheel = (e: WheelEvent) => {
            e.preventDefault();
            const w = this.viewBox.w;
            const h = this.viewBox.h;
            const rect = this.svg.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const dh = -1 * (w * Math.sign(e.deltaY) * 0.1);
            const dw = -1 * (h * Math.sign(e.deltaY) * 0.1);
            const dx = dw * mx / this.map.width;
            const dy = dh * my / this.map.height;

            this.viewBox = {x: this.viewBox.x + dx, y: this.viewBox.y + dy, w: this.viewBox.w - dw, h: this.viewBox.h - dh};
            this.scale = this.map.width / this.viewBox.w;

            this.svg.setAttributeNS(null, 'viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`);
        };

        svgContainer.onmousedown = (e: MouseEvent) => {
            this.isPanning = true;
            this.startPoint = { x: e.x , y: e.y };
            this.endPoint = { x: e.x , y: e.y };
        };

        svgContainer.onmousemove = (e: MouseEvent) => {
            if (this.isPanning) {
                this.endPoint = { x: e.x, y: e.y };
                const dx = (this.startPoint.x - this.endPoint.x) / this.scale;
                const dy = (this.startPoint.y - this.endPoint.y) / this.scale;
                const movedViewBox = { x: this.viewBox.x + dx, y: this.viewBox.y + dy, w: this.viewBox.w, h: this.viewBox.h };
                this.svg.setAttributeNS(null, 'viewBox', `${movedViewBox.x} ${movedViewBox.y} ${movedViewBox.w} ${movedViewBox.h}`);
            }
        };

        svgContainer.onmouseup = (e: MouseEvent) => {
            if (this.isPanning) {
                this.endPoint = { x: e.x , y: e.y };
                const dx = (this.startPoint.x - this.endPoint.x) / this.scale;
                const dy = (this.startPoint.y - this.endPoint.y) / this.scale;
                if (dx !== 0 || dy !== 0) {
                    this.viewBox = { x: this.viewBox.x + dx, y: this.viewBox.y + dy, w: this.viewBox.w, h: this.viewBox.h };
                    this.svg.setAttributeNS(null, 'viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`);
                }
                this.isPanning = false;
            }
        };

        svgContainer.onmouseleave = svgContainer.onmouseup;
    }

    private drawPopup(x: number, y: number, index: number) {

        // create a canvas to measure text, because SVG sucks at it
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        ctx.font = '13px visitor2';

        const map = this.map as HMapGridMap;
        const mapData = map.mapData as HMapDesertData;
        const currentPos = mapData.getCoordinates(index);
        const relativePos = mapData.getPositionRelativeToTown(currentPos);
        let numberOfLines = 0;

        // "Title" of the popup : building name & position
        let title = 'Desert ';
        let maxTextWidth = 0;
        const buildingId = mapData.details[index]._c;
        if (buildingId > 0 || buildingId === - 1) {
            if (buildingId === 1) {
                title = mapData.townName + ' ';
            } else if (buildingId === -1) {
                title = HMapLang.get('undigged') + ' ';
            } else {
                const buildingName = mapData.buildings.get(buildingId);
                if (buildingName) {
                    title = buildingName + ' ';
                }
            }
        }
        title += '[ ' + relativePos.x + ' , ' + relativePos.y + ' ]';
        maxTextWidth = ctx.measureText(title).width;
        numberOfLines++;

        // tags measurements
        if (mapData.details[index]._t > 0 && map.displayTags) {
            const tagName = HMapLang.get(this.getTagName(mapData.details[index]._t));
            maxTextWidth = Math.max(ctx.measureText(tagName).width, maxTextWidth);
            numberOfLines++;
        }

        // danger measurements
        let dangerName: string | undefined;
        if (mapData.details[index]._z > 0) {
            if (mapData.details[index]._z > 9) {
                dangerName = HMapLang.get('manyZombies');
            } else if (mapData.details[index]._z > 5) {
                dangerName = HMapLang.get('medZombies');
            } else {
                dangerName = HMapLang.get('fewZombies');
            }
            maxTextWidth = Math.max(ctx.measureText(dangerName).width, maxTextWidth);
            numberOfLines++;
        }

        // build arrays with user name inside (each entry is a line of 3 users)
        const users = mapData.users.get(index);
        const usernamesAllLines: Array<string> = new Array();
        if (users !== undefined && mapData.details[index]._c !== 1) {
            let singleLine: Array<string> = new Array();
            for (let u = 0; u < users.length; u++) {
                const user = users[u];
                singleLine.push(user._n);
                if (u > 0 && (u + 1) % 3 === 0) { // % 3 = 3 users per line
                    const singleLineStr = singleLine.join(', ');
                    maxTextWidth = Math.max(ctx.measureText(singleLineStr).width, maxTextWidth);
                    usernamesAllLines.push(singleLineStr);
                    singleLine = new Array();
                    numberOfLines++;
                }
            }
            if (singleLine.length > 0) { // last line
                const singleLineStr = singleLine.join(', ');
                maxTextWidth = Math.max(ctx.measureText(singleLineStr).width, maxTextWidth);
                usernamesAllLines.push(singleLineStr);
                numberOfLines++;
            }
        }

        // start the drawing of the popup itself
        const popupWidth = Math.floor(maxTextWidth + 10);
        const popupHeight = 15 * numberOfLines;
        const minWidthHeight = Math.min(map.width, map.height);
        const xPopup = Math.floor(Math.min( Math.max(x - popupWidth / 2, 0), minWidthHeight - popupWidth));
        const yPopup = Math.max(y - popupHeight, 0) | 0;

        // draw the rect
        const popup: SVGRectElement = this.rect(xPopup, yPopup, popupWidth, popupHeight, '#000000', '#b9ba3e', 1);
        popup.setAttributeNS(null, 'fill-opacity', '0.6');
        popup.setAttributeNS(null, 'class', 'hmap-popup');
        popup.style.pointerEvents = 'none';

        // draw the title
        numberOfLines = 0; // restart the counting ...
        const titleSize = ctx.measureText(title).width;
        this.text(
            xPopup + popupWidth / 2 - titleSize / 2,
            yPopup + 7.5,
            title,
            'hmap-text-green hmap-popup');
        numberOfLines++;

        // draw the tag
        if (mapData.details[index]._t > 0 && map.displayTags) {
            const tagName = HMapLang.get(this.getTagName(mapData.details[index]._t));
            const tagWidth = ctx.measureText(tagName).width;
            this.text(
                xPopup + popupWidth / 2 - tagWidth / 2,
                yPopup + 7.5 + 15 * numberOfLines,
                tagName,
                'hmap-text-green hmap-popup');
            numberOfLines++;
        }

        // draw the danger line
        if (dangerName !== undefined) {
            const dangerWidth = ctx.measureText(dangerName).width;
            const dangerText = this.text(
                xPopup + popupWidth / 2 - dangerWidth / 2,
                yPopup + 7.5 + 15 * numberOfLines,
                dangerName,
                'hmap-text-yellow hmap-popup');
            dangerText.style.fill = '#fefe00'; // overwrite the color
            numberOfLines++;
        }

        // draw the usernames
        usernamesAllLines.forEach((lineToWrite, _index) => {
            const lineSize = ctx.measureText(lineToWrite).width;

            const line = this.text(
                xPopup + popupWidth / 2 - lineSize / 2,
                yPopup + 7.5 + (_index + numberOfLines ) * 15,
                lineToWrite,
                'hmap-text-yellow hmap-popup'
            );
            line.style.fill = '#fefe00'; // overwrite the color
        });

        document.querySelectorAll('.hmap-popup').forEach((element) => {
            (element as HTMLElement).style.zIndex = '11';
        });
    }

    private getTagName(tagIndex: number): (keyof HMapTraduction) {
        switch (tagIndex) {
            case 1:
                return 'tag_1';
            case 2:
                return 'tag_2';
            case 3:
                return 'tag_3';
            case 4:
                return 'tag_4';
            case 5:
                return 'tag_5';
            case 6:
                return 'tag_6';
            case 7:
                return 'tag_7';
            case 8:
                return 'tag_8';
            case 9:
                return 'tag_9';
            case 10:
                return 'tag_10';
            case 11:
                return 'tag_11';
            case 12:
                return 'tag_12';
            default:
                throw new  Error('HMapSVGGridLayer::getTagName - Wrong tag index');
        }
    }
}
