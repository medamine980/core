// TODO: Add language codes with long format `lang-sublang`
// Unsupported: ["bn-BD","bs-Latn","yue","otq","zh-Hant","zh-Hans","tlh","sr-Cyrl","sr-Latn","fil","mww","yua","mhr","pap","ceb","mrj","udm"]

// Valid ISO 639-2 codes
// eslint-disable
// prettier-ignore
export const langCodes = <const>[
	"aa", "ab", "af", "ak", "sq", "am", "ar", "an", "hy", "as",
	"av", "ae", "ay", "az", "ba", "bm", "eu", "be", "bn", "bh",
	"bi", "bo", "bs", "br", "bg", "my", "ca", "cs", "ch", "ce",
	"zh", "cu", "cv", "kw", "co", "cr", "cy", "da", "de", "dv",
	"nl", "dz", "el", "en", "eo", "et", "ee", "fo", "fa", "fj",
	"fi", "fr", "fy", "ff", "ka", "gd", "ga", "gl", "gv", "gn",
	"gu", "ht", "ha", "he", "hz", "hi", "ho", "hr", "hu", "ig",
	"is", "io", "ii", "iu", "ie", "ia", "id", "ik", "it", "jv",
	"ja", "kl", "kn", "ks", "kr", "kk", "km", "ki", "rw", "ky",
	"kv", "kg", "ko", "kj", "ku", "lo", "la", "lv", "li", "ln",
	"lt", "lb", "lu", "lg", "mk", "mh", "ml", "mi", "mr", "ms",
	"mg", "mt", "mn", "na", "nv", "nr", "nd", "ng", "ne", "nn",
	"nb", "no", "ny", "oc", "oj", "or", "om", "os", "pa", "pi",
	"pl", "pt", "ps", "qu", "rm", "ro", "rn", "ru", "sg", "sa",
	"si", "sk", "sl", "se", "sm", "sn", "sd", "so", "st", "es",
	"sc", "sr", "ss", "su", "sw", "sv", "ty", "ta", "tt", "te",
	"tg", "tl", "th", "ti", "to", "tn", "ts", "tk", "tr", "tw",
	"ug", "uk", "ur", "uz", "ve", "vi", "vo", "wa", "wo", "xh",
	"yi", "yo", "za", "zu"
];

// eslint-enable

export type langCode = typeof langCodes[number];
export type langCodeWithAuto = 'auto' | langCode;

/**
 * Basic interface for translator
 */
export interface ITranslator {
	/**
	 * Is it supported value `auto` in `langFrom` argument of `translate` and `translateBatch` methods
	 */
	isSupportAutodetect(): boolean;

	/**
	 * Array of supported languages as ISO 639-1 codes
	 */
	supportedLanguages(): langCode[];

	/**
	 * Max length of string for `translate` or total length of strings from array for `translateBatch`
	 */
	lengthLimit(): number;

	/**
	 * Check string or array of stings to exceeding of a limit
	 *
	 * It need for modules with complexity logic of encoding a strings.
	 * For example, when in `translateBatch` text merge to string
	 * and split to chunks by tokens with ID: `<id1>Text 1</id1><id2>Text 2</id2>`
	 *
	 * Here checked result of encoding a input data
	 * @returns number of extra chars
	 */
	checkLimitExceeding(text: string | string[]): number;

	/**
	 * Recomended delay between requests
	 */
	throttleTime?: () => number;

	/**
	 * Check supporting of translate direction
	 */
	checkDirection?: (langFrom: langCodeWithAuto, langTo: langCode) => boolean;

	/**
	 * Translate text from string
	 * @returns Translated string
	 */
	translate(
		text: string,
		langFrom: langCodeWithAuto,
		langTo: langCode,
	): Promise<string>;

	/**
	 * Translate text from array of string
	 * @returns Array with translated strings and same length as input array. Not translated elements replace to undefined
	 */
	translateBatch(
		text: string[],
		langFrom: langCodeWithAuto,
		langTo: langCode,
	): Promise<Array<string | undefined>>;
}

export type CorsProxy = string | ((url: string) => string);

export interface TranslatorOptions {
	/**
	 * Access key for requests to translator API
	 */
	apiKey?: string;

	/**
	 * Union text array to 1 request (or more, but less than usualy anyway).
	 *
	 * Option for reduce the number of requests, but it can make artefacts in translated text.
	 *
	 * Some modules may not support this feature.
	 */
	useMultiplexing?: boolean;

	/**
	 * Additional headers for requests
	 */
	headers?: Record<string, string>;

	/**
	 * Proxy prefix or transform function which return url with CORS proxy
	 *
	 * CORS proxy useful to avoid CORS error in browser or to mask server requests as browser requests.
	 *
	 * All requests will send through this proxy server and this server will modify headers
	 */
	corsProxy?: CorsProxy;
}

// TODO: make all information methods static, for simplify filtration of modules

/**
 * Basic abstract class for translator
 */
export abstract class Translator implements ITranslator {
	/**
	 * Is it required API key in constructor
	 */
	static isRequiredKey() {
		return false;
	}

	static readonly moduleName: string = 'UnknownTranslator';

	checkLimitExceeding(text: string | string[]) {
		const plainText = Array.isArray(text) ? text.join('') : text;
		const extra = plainText.length - this.lengthLimit();
		return extra > 0 ? extra : 0;
	}

	/**
	 * Util to wrap url to CORS proxy
	 */
	protected wrapUrlToCorsProxy = (url: string) => {
		// Use as prefix
		if (typeof this.options.corsProxy === 'string') {
			return this.options.corsProxy + url;
		}

		// Run user defined transformation
		if (typeof this.options.corsProxy === 'function') {
			return this.options.corsProxy(url);
		}

		return url;
	};

	throttleTime() {
		return 0;
	}

	protected readonly options: TranslatorOptions = {};
	constructor(options?: TranslatorOptions) {
		if (options !== undefined) {
			this.options = options;
		}
	}

	abstract isSupportAutodetect(): boolean;
	abstract supportedLanguages(): langCode[];
	abstract lengthLimit(): number;

	abstract translate(
		text: string,
		langFrom: langCodeWithAuto,
		langTo: langCode,
	): Promise<string>;

	abstract translateBatch(
		text: string[],
		langFrom: langCodeWithAuto,
		langTo: langCode,
	): Promise<Array<string | undefined>>;
}
