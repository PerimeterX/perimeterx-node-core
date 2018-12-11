module.exports = {
    "env": {
        "browser": true,
        "node": true,
        "es6": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "sourceType": "module",
        "ecmaVersion": 2017
    },
    "rules": {
        "indent": [
            "error",
            4,
            {"SwitchCase": 1}
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "single",
            {
                "allowTemplateLiterals": true,
                "avoidEscape": true
            }
        ],
        "semi": [
            "error",
            "always"
        ],
        "no-useless-escape": ["warn"],
        "no-undef": ["error"],
        "no-console": "off",
        "no-multiple-empty-lines": ["error", {"max": 1}],
        "no-var": ["error"],
        "brace-style": ["error", "1tbs", { "allowSingleLine": true }],
        "prefer-const": ["error", {"destructuring": "all"}],
        "space-before-blocks": ["error", "always"],
        "comma-spacing": ["error"],
        "camelcase": ["error", {"properties": "never"}],
        "no-empty": ["error", {"allowEmptyCatch": true}]
    }
};
