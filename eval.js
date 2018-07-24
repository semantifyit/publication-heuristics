const puppeteer = require('puppeteer');
const xl = require('excel4node');
const request = require('request-promise-native');
const fs = require('fs');

const bacheBaseUrl = 'http://bache.rotes-wildschwein.at/index.php/';
const actionsBaseUrl = 'https://actions.semantify.it/api/feratel/publish/';
const actionsEndUrl = '/123asd';

const numDays = [1, 15, 30, 60, 90, 135, 180, 270, 365, 730, 1095, 1460]; // , 1825];
// const numDays = [1460]; // , 1460, 1825];
// const numDays = [1, 5];
const numSamples = 1;

const getNumDays = () => numDays.reduce((o, key) => ({ ...o, [key]: [] }), {});

const base = {
    '1: Abstration': {
        bache: `${bacheBaseUrl}feratel-1-abstraction/`,
        actions: `${actionsBaseUrl}1`,
        time: getNumDays(),
        space: getNumDays(),
    },
    '2: Specialization': {
        bache: `${bacheBaseUrl}feratel-2-specialization/`,
        actions: `${actionsBaseUrl}2${actionsEndUrl}`,
        time: getNumDays(),
        space: getNumDays(),
    },
    '3: Type-level materialization': {
        bache: `${bacheBaseUrl}feratel-3-type-level-materialization/`,
        actions: `${actionsBaseUrl}3${actionsEndUrl}`,
        time: getNumDays(),
        space: getNumDays(),
    },
    '4: Selective-intance-level materialization': {
        bache: `${bacheBaseUrl}feratel-4-selective-intance-level-materialization/`,
        actions: `${actionsBaseUrl}4${actionsEndUrl}`,
        time: getNumDays(),
        space: getNumDays(),
    },
    '5: Full materialization': {
        bache: `${bacheBaseUrl}feratel-5-full-materialization/`,
        actions: `${actionsBaseUrl}5${actionsEndUrl}`,
        time: getNumDays(),
        space: getNumDays(),
    },
};

const wb = new xl.Workbook();
const wss = {
    time: wb.addWorksheet('Time'),
    space: wb.addWorksheet('Space'),
};

const getMillis = hrtime => Math.floor(((hrtime[0] * 1e9) + hrtime[1]) / 1e6);

function byteCount(s) {
    return encodeURI(s).split(/%..|./).length - 1;
}

const average = (arr) => {
    let sum = 0;
    let fails = 0;
    arr.forEach((e) => {
        if (e !== 'Inf') {
            sum += e;
        } else {
            fails += 1;
        }
    });
    return sum / (arr.length - fails);
};

const checkSpace = async (url, type, day) => {
    try {
        const result = await request(url);
        base[type].space[day].push(byteCount(result));
    } catch (e) {
        console.log('---------------Start Error-------------');
        console.log(e);
        console.log('---------------End Error---------------');
        base[type].space[day].push('Inf');
    }
};

const checkTime = async (url, type, day) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const t0 = process.hrtime();
    try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 600000 });
        const t1 = process.hrtime(t0);
        base[type].time[day].push(getMillis(t1));
    } catch (e) {
        base[type].time.push('Inf');
    }
    await browser.close();
};

const writeToExcel = () => {
    Object.entries(base).forEach(([k, v], i) => {
        Object.entries(v.time).forEach(([day, arr], j) => {
            // console.log(arr);
            const avg = Math.floor(average(arr));
            if (avg) {
                wss.time.cell(j + 2, i + 2).number(avg);
            } else {
                wss.time.cell(j + 2, i + 2).string('Inf');
            }
        });
        Object.entries(v.space).forEach(([day, arr], j) => {
            // console.log(arr);
            const avg = Math.floor(average(arr));
            if (avg) {
                wss.space.cell(j + 2, i + 2).number(avg);
            } else {
                wss.space.cell(j + 2, i + 2).string('Inf');
            }
        });
    });
};


const start = async () => {
    Object.values(wss).forEach((ws) => {
        Object.keys(base).forEach((type, i) => {
            ws.cell(1, i + 2).string(type);
        });
    });
    for (let ite = 0; ite < numSamples; ite += 1) {
        for (const [i, day] of numDays.entries()) {
            Object.values(wss).forEach((ws) => {
                ws.cell(i + 2, 1).string(`${day} days`);
            });
            await request(`https://actions.semantify.it/api/feratel/settings/numdays/${day}`);
            for (const [k, v] of Object.entries(base)) {
                await checkTime(v.bache, k, day);
                if (ite === 0) {
                    await checkSpace(v.actions, k, day);
                }
                console.log('done ', k);
            }
            console.log('done days ', i);
        }
        console.log('done sample ', ite);
    }
    // console.log(JSON.stringify(base, null, 2));
    console.log('done');
    writeToExcel();
    wb.write(`Excel_norender_space${numSamples}.xlsx`);
};

start();
