import { route, startRouter, rerenderCurrent } from './router';
import { renderDashboard } from './views/dashboard';
import { renderSettings } from './views/settings';
import { renderNewObject } from './views/newObject';
import { renderObjectDetail } from './views/objectDetail';
import { renderLicenses } from './views/licenses';
import { t, getLocale, setLocale, onLocaleChange, type Locale } from './i18n';

route('/', renderDashboard);
route('/settings', renderSettings);
route('/objects/new', renderNewObject);
route('/objects/:id', renderObjectDetail);
route('/licenses', renderLicenses);

function applyChrome() {
	document.documentElement.lang = getLocale();
	document.title = t('nav.brand');
	(document.getElementById('navBrand') as HTMLElement).textContent = t('nav.brand');
	(document.getElementById('navDashboard') as HTMLElement).textContent = t('nav.dashboard');
	(document.getElementById('navNewObject') as HTMLElement).textContent = t('nav.newObject');
	(document.getElementById('navLicenses') as HTMLElement).textContent = t('nav.licenses');
	(document.getElementById('navSettings') as HTMLElement).textContent = t('nav.settings');
	const select = document.getElementById('langSwitch') as HTMLSelectElement;
	select.value = getLocale();
}

const langSwitch = document.getElementById('langSwitch') as HTMLSelectElement;
langSwitch.addEventListener('change', () => setLocale(langSwitch.value as Locale));

onLocaleChange(() => {
	applyChrome();
	rerenderCurrent();
});

applyChrome();

const view = document.getElementById('view');
if (view) startRouter(view);
