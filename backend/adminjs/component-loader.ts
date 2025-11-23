/* eslint-disable linebreak-style */
import path from 'path';
import { fileURLToPath } from 'url';

import { ComponentLoader } from 'adminjs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const componentLoader = new ComponentLoader();
export const Components = {
    Dashboard: componentLoader.add(
        'Dashboard',
        path.resolve(__dirname, './components/Dashboard'),
    ),
    Login: componentLoader.override(
        'Login',
        path.resolve(__dirname, './components/Login'),
    ),
    ImageComponent: componentLoader.add("ImageViewComponent", path.resolve(__dirname, './components/ImageViewComponent')),
    ThumbnailList: componentLoader.add("ThumbnailList", path.resolve(__dirname, './components/ThumbnailList')),
    TruncatedText: componentLoader.add("TruncatedText", path.resolve(__dirname, './components/TruncatedText')),
};
