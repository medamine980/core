import { readFileSync } from 'fs';
import path from 'path';

import { TranslatorClass } from '../../types/Translator';
import { getLanguageCodesISO639v2 } from '../../util/languages';

import { GoogleTranslator, GoogleTranslatorTokenFree } from '../GoogleTranslator';
import { YandexTranslator } from '../YandexTranslator';
import { TartuNLPTranslator } from '../TartuNLPTranslator';
import { DeepLTranslator } from '../DeepL';
import { LibreTranslateTranslator } from '../LibreTranslateTranslator';

const commonTranslatorOptions = {
	headers: {
		// This is required for most translate services API
		'User-Agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36',
	},
};

// Verify types
const translators: TranslatorClass[] = [
	GoogleTranslator,
	GoogleTranslatorTokenFree,
	YandexTranslator,
	TartuNLPTranslator,
];

type TranslatorWithOptions = {
	translator: TranslatorClass;
	options: Record<string, any>;
};
const translatorsWithOptions: TranslatorWithOptions[] = [
	{
		translator: DeepLTranslator,
		options: { apiKey: process.env.DEEPL_KEY_FREE },
	},
	{
		translator: LibreTranslateTranslator,
		options: process.env.TEST_LIBRETRANSLATE_API_ENDPOINT
			? {
				apiEndpoint: process.env.TEST_LIBRETRANSLATE_API_ENDPOINT,
				apiKey: process.env.TEST_LIBRETRANSLATE_API_KEY,
			  }
			: {},
	},
];

const isStringStartFromLetter = (text: string) => Boolean(text.match(/^\p{Letter}/u));

const currentDir = path.dirname(__filename);
const longTextForTest = readFileSync(
	path.resolve(currentDir, 'resources/text-long.txt'),
).toString('utf8');

const LONG_TEXT_TRANSLATION_TIMEOUT = 80000;

// TODO: use `こんにちは` > `hello`
describe('Test translators', () => {
	jest.setTimeout(60000);

	const translatorsForTest: TranslatorWithOptions[] = [
		...translatorsWithOptions.filter((translator) => {
			const { translator: translatorClass, options } = translator;
			if (Object.values(options).length === 0) {
				console.warn(
					`Skip tests for translator "${translatorClass.translatorName}", because options is not specified`,
				);
				return false;
			}

			return true;
		}),
		...translators.map((translator) => ({ translator, options: {} })),
	];

	translatorsForTest.forEach(({ translator: translatorClass, options }) => {
		const translatorName = translatorClass.translatorName;

		const isKeyRequiredButNotSpecified =
			translatorClass.isRequiredKey() && !options.apiKey;
		if (isKeyRequiredButNotSpecified) {
			console.warn(
				`Skip tests for translator "${translatorName}", because access key is not specified`,
			);
			return;
		}

		const translatorOptions = { ...commonTranslatorOptions, ...options };

		test(`${translatorName}: method "getSupportedLanguages" return language codes`, () => {
			const languages = translatorClass.getSupportedLanguages();

			const validLangCodes = getLanguageCodesISO639v2(languages);
			expect(validLangCodes.length).toBeGreaterThan(1);
		});

		test(`${translatorName}: test "translate" method`, (done) => {
			const translator = new translatorClass(translatorOptions);
			translator
				.translate('Hello world', 'en', 'ru')
				.then((translation) => {
					expect(typeof translation).toBe('string');
					expect(translation).toContain('мир');
					expect(isStringStartFromLetter(translation)).toBeTruthy();

					done();
				})
				.catch(done);
		});

		test(`${translatorName}: test "translateBatch" method with 1 text`, (done) => {
			const translator = new translatorClass(translatorOptions);
			translator
				.translateBatch(['Hello world'], 'en', 'ru')
				.then((translation) => {
					expect(Array.isArray(translation)).toBe(true);
					expect(translation.length).toBe(1);

					expect(translation[0]).toContain('мир');
					expect(
						isStringStartFromLetter(translation[0] as string),
					).toBeTruthy();

					done();
				})
				.catch(done);
		});

		test(`${translatorName}: test "translateBatch" method with 2 texts`, (done) => {
			const translator = new translatorClass(translatorOptions);
			translator
				.translateBatch(['Hello world', 'my name is Jeff'], 'en', 'ru')
				.then((translation) => {
					expect(Array.isArray(translation)).toBe(true);
					expect(translation.length).toBe(2);

					expect(translation[0]).toContain('мир');
					expect(translation[1]).toContain('Джефф');

					translation.every((translation) => {
						expect(typeof translation).toBe('string');
						expect(
							isStringStartFromLetter(translation as string),
						).toBeTruthy();
					});

					done();
				})
				.catch(done);
		});

		test(`${translatorName}: test "translateBatch" method with few texts`, async () => {
			const textsToTranslate = [
				'View source',
				'View history',
				'that',
				'athletics',
				'The',
				'province contracted to',
			];

			const translator = new translatorClass(translatorOptions);
			const translation = await translator.translateBatch(
				textsToTranslate,
				'en',
				'ru',
			);
			expect(typeof translation).toBe('object');
			expect(translation.length).toBe(textsToTranslate.length);
		});

		// Test long text
		test(
			`${translatorName}: test long text for "translate" method`,
			(done) => {
				const translator = new translatorClass(translatorOptions);
				translator
					.translate(longTextForTest, 'en', 'ru')
					.then((translation) => {
						expect(typeof translation).toBe('string');

						const expectedMinimalLength = longTextForTest.length * 0.7;
						expect(translation.length >= expectedMinimalLength).toBeTruthy();

						expect(isStringStartFromLetter(translation)).toBeTruthy();

						done();
					})
					.catch(done);
			},
			LONG_TEXT_TRANSLATION_TIMEOUT,
		);

		test(
			`${translatorName}: test long text for "translateBatch" method`,
			(done) => {
				const translator = new translatorClass(translatorOptions);
				translator
					.translateBatch([longTextForTest], 'en', 'ru')
					.then(([translation]) => {
						expect(typeof translation).toBe('string');

						const expectedMinimalLength = longTextForTest.length * 0.7;
						expect(
							(translation as string).length >= expectedMinimalLength,
						).toBeTruthy();

						expect(
							isStringStartFromLetter(translation as string),
						).toBeTruthy();

						done();
					})
					.catch(done);
			},
			LONG_TEXT_TRANSLATION_TIMEOUT,
		);

		// Test direction auto
		if (translatorClass.isSupportedAutoFrom()) {
			test(`${translatorName}: test "translate" method and language auto detection`, (done) => {
				const translator = new translatorClass(translatorOptions);
				translator
					.translate('Hello world', 'auto', 'ru')
					.then((translation) => {
						expect(typeof translation).toBe('string');
						expect(translation).toContain('мир');

						expect(isStringStartFromLetter(translation)).toBeTruthy();

						done();
					})
					.catch(done);
			});

			test(`${translatorName}: test "translateBatch" method with 1 text and language auto detection`, (done) => {
				const translator = new translatorClass(translatorOptions);
				translator
					.translateBatch(['Hello world'], 'auto', 'ru')
					.then((translation) => {
						expect(Array.isArray(translation)).toBe(true);
						expect(translation.length).toBe(1);

						expect(typeof translation[0]).toBe('string');

						expect(translation[0]).toContain('мир');

						expect(
							isStringStartFromLetter(translation[0] as string),
						).toBeTruthy();

						done();
					})
					.catch(done);
			});

			test(`${translatorName}: test "translateBatch" method with 2 texts and language auto detection`, (done) => {
				const translator = new translatorClass(translatorOptions);
				translator
					.translateBatch(['Hello world', 'my name is Jeff'], 'auto', 'ru')
					.then((translation) => {
						expect(Array.isArray(translation)).toBe(true);
						expect(translation.length).toBe(2);

						expect(typeof translation[0]).toBe('string');
						expect(typeof translation[1]).toBe('string');

						expect(translation[0]).toContain('мир');
						expect(translation[1]).toContain('Джефф');

						expect(
							isStringStartFromLetter(translation[0] as string),
						).toBeTruthy();
						expect(
							isStringStartFromLetter(translation[1] as string),
						).toBeTruthy();

						done();
					})
					.catch(done);
			});
		}
	});
});
