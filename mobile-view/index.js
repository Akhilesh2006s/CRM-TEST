import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { registerRootComponent } from 'expo';
import App from './App';

try {
  const errorUtils = global.ErrorUtils;
  if (errorUtils?.getGlobalHandler && errorUtils?.setGlobalHandler) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      console.error('Uncaught error', { isFatal, message: error?.message, error });
      if (typeof previous === 'function') {
        previous(error, false);
      }
    });
  }
} catch (_) {}

registerRootComponent(App);

