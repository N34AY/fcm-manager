import { route, startRouter } from './router';
import { renderDashboard } from './views/dashboard';
import { renderSettings } from './views/settings';
import { renderNewObject } from './views/newObject';
import { renderObjectDetail } from './views/objectDetail';
import { renderLicenses } from './views/licenses';

route('/', renderDashboard);
route('/settings', renderSettings);
route('/objects/new', renderNewObject);
route('/objects/:id', renderObjectDetail);
route('/licenses', renderLicenses);

const view = document.getElementById('view');
if (view) startRouter(view);
