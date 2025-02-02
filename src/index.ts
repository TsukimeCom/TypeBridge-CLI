#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import * as path from "path";
import { Command } from "commander";
import fetch from "node-fetch";
import {
    buildSchema,
    buildClientSchema,
    getIntrospectionQuery,
    GraphQLSchema,
    type GraphQLNamedType,
    GraphQLObjectType,
    GraphQLScalarType,
    GraphQLEnumType,
    GraphQLUnionType,
    GraphQLInterfaceType,
    isObjectType,
    isEnumType,
    isScalarType,
    isUnionType,
    isInterfaceType,
} from "graphql";


const scalarTypeMap = ["String", "Int", "Float", "Boolean", "ID", "NaiveTime", "NaiveDate", "NaiveDateTime"];
const ignoreFields = ["string", "number", "boolean"];
let enumTypes: string[] = [];

// Helper functions to map GraphQL types to TypeScript types.
function mapGraphQLTypeToTSType(graphqlType: string): string {
    return graphqlType
        .replace(/String/g, "string")
        .replace(/Int/g, "number")
        .replace(/Float/g, "number")
        .replace(/Boolean/g, "boolean")
        .replace(/ID/g, "string")
        .replace(/NaiveDateTime/g, "UTCDate")
        .replace(/NaiveTime/g, "UTCDate")
        .replace(/NaiveDate/g, "UTCDate");
}

function mapGraphQLScalarToTSType(scalarName: string): string {
    switch (scalarName) {
        case "String":
            return "string";
        case "Int":
        case "Float":
            return "number";
        case "Boolean":
            return "boolean";
        case "ID":
            return "string";
        case "NaiveDateTime":
            return "UTCDate";
        case "NaiveTime":
            return "UTCDate";
        case "NaiveDate":
            return "UTCDate";
        default:
            return "any"; // Fallback for custom scalars.
    }
}

function lowercaseFirstLetter(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
}

function generateTypeScriptForType(type: GraphQLNamedType): string {
    if (isObjectType(type)) {

        let imports = "";

        const fields = type.getFields();
        const fieldLines = Object.keys(fields)
            .map((fieldName) => {
                const field = fields[fieldName];
                let tsType = mapGraphQLTypeToTSType(field.type.toString());
                const cleanedType = tsType.replaceAll(/\[(.*)\]/gm, "$1").replaceAll("!", "");

                if (tsType.includes("UTCDate")) {
                    if (!imports.includes("UTCDate"))
                        imports += "import type {UTCDate} from '@date-fns/utc';\n";
                }
                else if (!imports.includes(cleanedType)) {
                    if (!(isScalarType(type) || ignoreFields.includes(cleanedType))) {
                        imports += enumTypes.includes(cleanedType) ? `import {${cleanedType}} from "./enums/${lowercaseFirstLetter(cleanedType)}";\n` : `import type {${cleanedType}} from "./${lowercaseFirstLetter(cleanedType)}";\n`;
                    }
                }

                tsType = tsType.replaceAll(/\[(.*)\]/gm, "$1[]");
                if (tsType.includes("!")) {
                    return `  ${fieldName}: ${tsType.replaceAll("!", "")};`;
                }
                else {
                    return `  ${fieldName}?: ${tsType};`;
                }
            })
            .join("\n");
        return `${imports}\nexport interface ${type.name} {\n${fieldLines}\n}`;
    }
    else if (isEnumType(type)) {
        const values = type.getValues();
        const enumMembers = values
            .map((value) => `  ${value.name} = "${value.value}"`)
            .join(",\n");
        return `export enum ${type.name} {\n${enumMembers}\n}`;
    }
    else if (isScalarType(type)) {
        const tsType = mapGraphQLScalarToTSType(type.name);
        return `export type ${type.name} = ${tsType};`;
    }
    else if (isInterfaceType(type)) {
        const fields = type.getFields();
        const fieldLines = Object.keys(fields)
            .map((fieldName) => {
                const field = fields[fieldName];
                const tsType = mapGraphQLTypeToTSType(field.type.toString());
                return `  ${fieldName}: ${tsType};`;
            })
            .join("\n");
        return `export interface ${type.name} {\n${fieldLines}\n}`;
    }
    else if (isUnionType(type)) {
        const types = type.getTypes().map((t) => t.name).join(" | ");
        return `export type ${type.name} = ${types};`;
    }
    return "";
}



async function main() {
    const program = new Command();
    program.version("0.1.0");

    // Read config file
    let config: { schema?: string; outDir: string; ignore: string[] } = {
        outDir: "./src/types/graphql",
        ignore: []
    };

    try {
        config = JSON.parse(readFileSync("graphql.config.json", "utf-8"));
    } catch (err) {
        console.error("Error reading config file:", err);
        process.exit(1);
    }

    if (!config.schema) {
        console.error("Error reading config file:", "No config file provided");
        process.exit(1);
    }

    const schemaPath: string = config.schema || "https://localhost:5000";
    const outDir: string = config.outDir;
    const ignore = config.ignore;

    if (!schemaPath || !outDir) {
        console.error(
            "Both 'schema' and 'outDir' must be provided (either via CLI options or config file)."
        );
        process.exit(1);
    }

    let schema: GraphQLSchema;

    // Check if schemaPath is a URL
    if (schemaPath.startsWith("http://") || schemaPath.startsWith("https://")) {
        // Use introspection to fetch the schema.
        const introspectionQuery = getIntrospectionQuery();
        try {
            const response = await fetch(schemaPath, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: introspectionQuery }),
            });

            if (!response.ok) {
                console.error("Failed to fetch schema from URL:", response.statusText);
                process.exit(1);
            }

            const result = (await response.json()) as { data: any; errors?: any };
            if (result.errors) {
                console.error("Errors in introspection query:", result.errors);
                process.exit(1);
            }

            schema = buildClientSchema(result.data);
            console.log(`Successfully fetched schema from ${schemaPath}`);
        } catch (error) {
            console.error("Error fetching schema from URL:", error);
            process.exit(1);
        }
    }
    else {
        // Assume schemaPath is a local file (SDL)
        try {
            const schemaContent = readFileSync(schemaPath, { encoding: "utf-8" });
            schema = buildSchema(schemaContent);
            console.log(`Successfully read schema from file ${schemaPath}`);
        } catch (error) {
            console.error("Error reading schema file:", error);
            process.exit(1);
        }
    }

    // Ensure the output directory exists, creating it if necessary.
    mkdirSync(outDir, { recursive: true });
    mkdirSync(path.join(outDir, "enums"), { recursive: true });

    // Get all types from the schema.
    const typeMap = schema.getTypeMap();

    // Generate Enum types first
    for (const typeName in typeMap) {
        if (typeName.startsWith("__")) continue;
        else if (ignore.includes(typeName)) continue;

        const type = typeMap[typeName];

        if (isScalarType(type) && scalarTypeMap.includes(type.name)) continue;
        else if (!isEnumType(type)) continue;

        const tsContent = generateTypeScriptForType(type);
        if (tsContent) {
            enumTypes.push(type.name);

            const filePath = path.join(outDir, "enums", `${lowercaseFirstLetter(type.name)}.ts`);
            writeFileSync(filePath, tsContent, { encoding: "utf-8" });
            console.log(`Generated ${filePath}`);
        }
    }

    // Generate the rest of the types
    for (const typeName in typeMap) {
        if (typeName.startsWith("__")) continue;
        else if (ignore.includes(typeName)) continue;

        const type = typeMap[typeName];

        if (isScalarType(type) && scalarTypeMap.includes(type.name)) continue;
        else if (isEnumType(type)) continue;

        const tsContent = generateTypeScriptForType(type);
        if (tsContent) {
            const filePath = path.join(outDir, `${lowercaseFirstLetter(type.name)}.ts`);
            writeFileSync(filePath, tsContent, { encoding: "utf-8" });
            console.log(`Generated ${filePath}`);
        }
    }
}

// Call the async main function and catch any top-level errors.
main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});
