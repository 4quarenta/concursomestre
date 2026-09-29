const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withRecaptchaDesugaring(config) {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') {
      throw new Error('The reCAPTCHA Android config plugin expects Groovy build.gradle.');
    }

    let contents = modConfig.modResults.contents;
    if (!contents.includes('coreLibraryDesugaringEnabled true')) {
      const androidBlockEnd = /\n}\n\n\/\/ Apply static values from `gradle\.properties`/;
      if (!androidBlockEnd.test(contents)) {
        throw new Error('Could not locate the Android block to enable reCAPTCHA desugaring.');
      }
      contents = contents.replace(
        androidBlockEnd,
        '\n    compileOptions {\n        coreLibraryDesugaringEnabled true\n    }\n}\n\n// Apply static values from `gradle.properties`',
      );
    }

    if (!contents.includes('com.android.tools:desugar_jdk_libs')) {
      const dependenciesStart = /dependencies \{/;
      if (!dependenciesStart.test(contents)) {
        throw new Error('Could not locate app dependencies for reCAPTCHA desugaring.');
      }
      contents = contents.replace(
        dependenciesStart,
        "dependencies {\n    coreLibraryDesugaring('com.android.tools:desugar_jdk_libs:2.1.5')",
      );
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });
};
