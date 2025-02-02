# 🌸Tsukime TypeBridge CLI

![Coverage Status](https://img.shields.io/badge/version-1.0.0-red)
![License](https://img.shields.io/badge/license-MIT-blue)

A simple tool that transforms GraphQL API types, including objects and enums, into TypeScript types.

## 🚀 Features

- **CLI:** Command-line interface for converting GraphQL schemas into TypeScript types.
- **Object Transformation:** Converts GraphQL objects into TypeScript interfaces.
- **Enum Mapping:** Transforms GraphQL enums into TypeScript enum declarations.

## ⚙️ Config File

The TypeBridge CLI uses a configuration file to specify the schema URL, output directory, and types to ignore. The configuration file is a JSON file with the following properties:
```json
{
  "schema": "http://localhost:5000",
  "outDir": "./types/graphql",
  "ignore": ["QueryRoot", "MutationRoot", "SubscriptionRoot"]
}
```
Make sure to create a `graphql.config.json` file in the root directory of your project.

## 🔧 Installation

1. Clone the repository:
```bash
git clone
```

2. Install the dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm build
```

4. Link the package:
```bash
npm link
```

## 🏃Usage

To convert a GraphQL schema into TypeScript types, run the following command:
```bash
tsukime-gql
```