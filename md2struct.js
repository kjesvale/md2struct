const readline = require("readline");
const fs = require("fs");

const input = "input.md";
console.log("   == md2struct ==\n");
console.log("-> Parsing file", input);

const lineReader = readline.createInterface({
    input: fs.createReadStream(input)
});

const output = [];

const navHeaders = [
    "sidetittel",
    "innholdstittel",
    "systemtittel",
    "undertittel",
    "ingress",
    "element"
];

const getDefaultTextPart = () => ({
    type: "span",
    text: "",
    marks: []
});

const getModifier = (current, next) => {
    if (current === "_") {
        return "italic";
    } else if (current === "*") {
        return next === "*" ? "bold" : "italic";
    } else {
        return null;
    }
};

const parseTextArray = line => {
    const markDefs = [];

    let parsedText = [];
    let currentTextPart = getDefaultTextPart();
    let currentModifier = null;

    for (let i = 0; i < line.length; i++) {
        const currentChar = line.charAt(i);
        const nextChar = line.charAt(i + 1);

        // Is there a modifier?
        const modifier = getModifier(currentChar, nextChar);

        // If a modifier is active, check if it should end.
        if (currentModifier && modifier) {
            parsedText.push(currentTextPart);
            currentTextPart = getDefaultTextPart();

            // Skip next character if bold
            if (modifier === "bold") {
                i += 1;
            }

            currentModifier = null;
        } else if (modifier) {
            // New modifier
            if (currentTextPart.text !== "") {
                parsedText.push(currentTextPart);
                console.log("New modifier, pushed:", currentTextPart.text);
            }

            // Reset current text part
            currentTextPart = getDefaultTextPart();

            // Apply the new modifier
            currentTextPart.marks.push(modifier);
            currentModifier = modifier;

            // Skip next character if bold
            if (modifier === "bold") {
                i += 1;
            }
        } else if (currentChar === "[") {
            if (currentTextPart.text !== "") {
                parsedText.push(currentTextPart);
            }

            currentTextPart = getDefaultTextPart();

            // Find end of link.
            const linkEnd = line.substr(i).indexOf("]");
            const linkText = line.substr(i + 1, linkEnd - 1);
            const hrefEnd = line.indexOf(")");
            const hrefBegin = line.indexOf("(") + 1;
            const hrefLength = hrefEnd - hrefBegin;
            const linkHref = line.substr(hrefBegin, hrefLength);

            currentTextPart.text = linkText;
            const key = `url_${linkText.replace(/ /g, "_")}`;

            currentTextPart.marks.push(key);

            markDefs.push({
                key,
                type: "link",
                href: linkHref
            });

            parsedText.push(currentTextPart);
            currentTextPart = getDefaultTextPart();
            i = hrefEnd;
        } else {
            // No new modifier, continue parsing text
            currentTextPart.text = currentTextPart.text.concat(currentChar);
        }
    }

    // Push any remaining text
    if (currentTextPart.text !== "") {
        parsedText.push(currentTextPart);
    }

    // Return fully parsed text.
    return {
        parsedText,
        markDefs
    };
};

const buildHeader = line => {
    let level;
    for (level = 1; level < line.length; level++) {
        if (line.charAt(level) !== "#") break;
    }

    const style = level > 0 ? navHeaders[level - 1] : "normaltekst";

    // Parse from last '#'
    let children = parseTextArray(line.substr(level).trim()).parsedText;

    const header = {
        type: "avsnitt",
        style,
        children
    };

    return header;
};

const buildNormalText = line => {
    const children = parseTextArray(line);

    const normalText = {
        type: "avsnitt",
        style: "normaltekst",
        children: children.parsedText,
        markDefs: children.markDefs
    };

    return normalText;
};

const buildListItem = (line, listType) => {
    const children = parseTextArray(line.substr(2)).parsedText;

    const listItem = {
        type: "avsnitt",
        style: "normaltekst",
        listItem: listType,
        level: 1,
        children
    };

    return listItem;
};

const parseLine = line => {
    const firstChar = line.charAt(0);

    if (firstChar === "#") {
        output.push(buildHeader(line));
    } else if (firstChar === "-" || firstChar === "*") {
        output.push(buildListItem(line, "bullet"));
    } else if (line !== "") {
        output.push(buildNormalText(line));
    }
};

// Execute program
lineReader.on("line", line => {
    parseLine(line);
});

lineReader.on("close", () => {
    fs.writeFile("output.json", JSON.stringify(output), "utf8", () => {
        console.warn("-> Successfully wrote to file");
    });
});
