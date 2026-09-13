import { installDevShim } from '../shared/devShim';
installDevShim();

import { createRoot } from 'react-dom/client';
import '../styles/tailwind.css';
import { OptionsApp } from './OptionsApp';

createRoot(document.getElementById('root')!).render(<OptionsApp />);
