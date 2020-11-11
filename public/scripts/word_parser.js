/*
Copyright 2020 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const _partsOfSpeech = new Set([
  'Adjective',
  'Adverb',
  'Conjunction',
  'Interjection',
  'Noun',
  'Preposition',
  'Pronoun',
  'Verb']);

class _Node {
  constructor(name) {
    this.name = name;
    this.value = [];
    this.children = {};
  }
}

class _Definition {
  constructor(partOfSpeech, definition, etymology) {
    this.partOfSpeech = partOfSpeech;
    this.definition = definition;
    this.etymology = etymology;
  }
}

function _determineSectionLevel(text) {
  var level = 0;

  for (let i = 0; i < text.length && text[i] === '='; i++) {
    level++;
  }

  return level;
}

function _getSectionName(text) {
  // REVIEW: consider simply returning anything between enclosing "=" delimiters
  return text.match(/=+([0-9A-Za-z\u00C0-\u017F -]+)=+/)[1];
}

function _parseWikiTree(text) {
  var sections = [];
  var currentLevel = 1;

  var rootNode = new _Node('');

  for (const line of text.split(/\r\n|\n/)) {
    const sectionLevel = _determineSectionLevel(line.trim());
    if (sectionLevel > 0) {
      // Process a tree section
      const sectionName = _getSectionName(line);

      if (sectionLevel > currentLevel) {
        if (sectionLevel - currentLevel > 1) {
          throw new Error('Unexpected nesting');
        }
        currentLevel = sectionLevel;
        sections.push(sectionName);

      } else if (sectionLevel <= currentLevel) {
        while (sectionLevel <= currentLevel) {
          sections.pop();
          currentLevel--;
        }
        currentLevel = sectionLevel;
        sections.push(sectionName);
      }
    } else {
      // Ensure the current section exists in the tree
      let currentNode = rootNode;
      for (const section of sections) {
        if (!(section in currentNode.children)) {
          currentNode.children[section] = new _Node(section);
        }
        currentNode = currentNode.children[section];
      }

      currentNode.value.push(line.trim());
    }
  }

  return rootNode;
}

function _processTree(treeNode) {
  treeNode.definitions = [];
  if (_partsOfSpeech.has(treeNode.name)) {
    for (const line of treeNode.value) {
      if (line.startsWith('# ')) {

        let definition = line;

        // Handle cases like 'text [foo|Foo] text'
        var match = definition.match(/\[[^]+?\|([^\]]+)\]/);
        while (match != null) {
          definition = definition.replace(/\[[^]+?\|([^\]]+)\]/, match[1]);
          match = definition.match(/\[[^]+?\|([^\]]+)\]/);
        }

        definition = definition.replace(/\[|\]/g, '');
        definition = definition.replace(/^# /, '');
        definition = definition.replace(/{{l\|[a-z]+\|(.*?)}}/g, '$1');
        definition = definition.replace(/{{.*?}}/g, '');
        definition = definition.replace(/&lt;!.*?&gt;/g, '');

        match = definition.match(/ {2}/);
        while (match != null) {
          definition = definition.replace(/ {2}/, ' ');
          match = definition.match(/ {2}/);
        }

        definition = definition.trim();
        if (definition.length > 0 && definition !== '.') {
          treeNode.definitions.push(definition.trim());
        }
      }
    }
  }
  for (const child of Object.values(treeNode.children)) {
    _processTree(child);
  }
}

function _parse(text) {
  var tree = _parseWikiTree(text);
  _processTree(tree);

  return tree;
}

function _getDefintions(parsedInfo, language) {
  var allDefinitions = [];
  if ((language) in parsedInfo.children) {
    const languageNode = parsedInfo.children[language].children;

    for (const partOfSpeech of ['Adjective', 'Adverb', 'Noun', 'Verb']) {
      if (partOfSpeech in languageNode) {
        for (const definition of languageNode[partOfSpeech].definitions) {
          allDefinitions.push(new _Definition(partOfSpeech, definition, 'Etymology 1'));
        }
      } else {
        for (const etymologyName of Object.keys(languageNode)) {
          if (etymologyName.match(/Etymology \d+/) != null) {
            if (partOfSpeech in languageNode[etymologyName].children) {
              for (const definition of
                languageNode[etymologyName].children[partOfSpeech].definitions) {
                allDefinitions.push(new _Definition(partOfSpeech, definition, etymologyName));
              }
            }
          }
        }
      }
    }
  }
  return allDefinitions;
}

var word_parser = {};
word_parser.parse = _parse;
word_parser.getDefintions = _getDefintions;
