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

function processDefinitions(payload, callback) {
    var allDefinitions = new Array();

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(payload, 'text/xml');
    const text = xmlDoc.getElementsByTagName('text')[0];
    const parsedInfo = word_parser.parse(text.firstChild.nodeValue);
    const definitions = word_parser.getDefintions(parsedInfo, 'English');
    for (const definition of definitions) {
        allDefinitions.push(definition.definition);
    }
  
    callback(allDefinitions);
}

function lookupWord(word, callback) {
    const xmlHttpRequest = new XMLHttpRequest();
    const url = 'https://en.wiktionary.org/w/api.php?' +
      'format=json&action=query&origin=*&export&exportnowrap&titles=' + word;
    xmlHttpRequest.open("GET", url);
    xmlHttpRequest.send();
    xmlHttpRequest.onreadystatechange=(e)=>{
        if (xmlHttpRequest.readyState == 4) {
            if (xmlHttpRequest.status == 200){
                processDefinitions(xmlHttpRequest.responseText, callback);
            } else {
                console.log("Error fetching definition: " + xmlHttpRequest.status);
                callback(new Array());
            }
        }
    }
}
