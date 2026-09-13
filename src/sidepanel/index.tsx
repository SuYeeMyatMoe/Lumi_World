import { installDevShim } from '../shared/devShim';
installDevShim();

import { createRoot } from 'react-dom/client';
import '../styles/tailwind.css';
import { SidePanelApp } from './SidePanelApp';

createRoot(document.getElementById('root')!).render(<SidePanelApp />);
