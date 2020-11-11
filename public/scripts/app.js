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

(function () {
  'use strict';

  var UIMode = {
    LIST: 1,
    FLASHCARDS: 2,
    ACCOUNT: 3,
  };

  var app = {
    mainContainer: document.querySelector('.main'),
    wordsContainer: document.querySelector('.words'),
    topAppBarElement: document.getElementById('app-bar'),
    firebaseConfig: {
      apiKey: "AIzaSyBEtHo04PAo5z1PN0MYQxoN7tjYXPYTPac",
      authDomain: "my-words-69377.firebaseapp.com",
      databaseURL: "https://my-words-69377.firebaseio.com",
      projectId: "my-words-69377",
      storageBucket: "my-words-69377.appspot.com",
      messagingSenderId: "14425425625"
    },
    firebaseUiConfig: {
      callbacks: {
        signInSuccessWithAuthResult: function (authResult, redirectUrl) {
          // Do not redirect.
          return false;
        }
      },
      signInOptions: [
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      ]
    },
    firebaseUi: null,
    firestore: null,
    uiMode: UIMode.LIST,
    wordList: new Array(),
    userAccountCard: document.getElementById("user-account-card"),
    flashCard: document.getElementById("flash-card"),
    fab: document.getElementById("fab"),
    addWordDialog: null,
    deleteWordDialog: null,
    wordDetailDialog: null,
    currentWord: null,
    currentDefinitions: new Array(),
    firestoreSnapshotListener: null,
    userId : null,
    wordToDelete: null,
    flashCardIndex: 0,
    processingFlashcardAction : false
  };

  function lookupWordDefinitions(dialog, word) {
    const ulTemplate = '<ul class="mdc-list mdc-list--avatar-list" style="list-style-type: none;">{0}</ul>';
    const itemTemplate = '<li class="mdc-list-item" tabindex="0" data-mdc-dialog-action="{0}"><span class="test-list-item__label">{1}</span></li>';

    lookupWord(word, function(definitions) {
      app.currentDefinitions = definitions;

      var html = new Array();
      var definitionIndex = 0;
      for (let definition of definitions) {
        html.push(itemTemplate.replace("{0}", definitionIndex).replace("{1}", definition));
        definitionIndex++;
      }

      dialog.content_.innerHTML = ulTemplate.replace("{0}", html.join('<hr class="mdc-card__divider">'));
    });    
  }

  function addWordCard(wordEntry, entryBefore) {
    var card = document.getElementById("word-" + wordEntry.word);
    if (card == null) {
      // Create new
      var cardTemplate = document.getElementById("card-template");
      var card = cardTemplate.cloneNode(true);
      card.querySelector(".word").innerText = wordEntry.word;
      card.querySelector(".definition").innerText = wordEntry.definition;
      card.style.display = "block";
      card.setAttribute("id", "word-" + wordEntry.word);
      card.querySelector('.delete-word').addEventListener('click', function(event) {
        event.stopPropagation();
        app.wordToDelete = wordEntry.id;
        app.deleteWordDialog.open();
      });
      card.querySelector('.image-search').addEventListener('click', function(event) {
        event.stopPropagation();
        let url = "http://www.google.com/search?q=" + wordEntry.word + "&tbm=isch";
        window.open(url);
      });
      card.querySelector('.web-search').addEventListener('click', function(event) {
        event.stopPropagation();
        let url = "https://www.google.com/search?q=" + wordEntry.word;
        window.open(url);
      });

      card.addEventListener('click', function(event) {
        var targetElement = event.target;
        while (!targetElement.classList.contains("word-card")) {
          targetElement = targetElement.parentNode;
        }
        let word = targetElement.querySelector(".word").innerText;
        
        app.wordDetailDialog.content_.innerHTML = app.addWordDialog.content_.innerHTML = "<img src='images/spinner.gif' alt='loading'>";
        app.wordDetailDialog.container_.querySelector("#my-dialog-title").innerText = word;
        app.wordDetailDialog.open();
        lookupWordDefinitions(app.wordDetailDialog, word);
      });

      if (entryBefore == null) {
        app.wordsContainer.appendChild(card);
      } else {
        var nextCard = document.getElementById("word-" + entryBefore.word);
        app.wordsContainer.insertBefore(card, nextCard);
      }  
    } else {
      // Update
      card.querySelector(".word").innerText = wordEntry.word;
      card.querySelector(".definition").innerText = wordEntry.definition;  
    }

    if (app.currentWord == wordEntry.word ) {
      card.scrollIntoView();
      document.scrollingElement.scrollTop -= app.topAppBarElement.scrollHeight + 10;
      app.currentWord = null;
    }
  }

  function pickRandomCard() {
    var min = 0;
    var max = 0;

    // First pass - collect min/max
    for (var entry of app.wordList) {
      var value = 0;
      if (typeof entry.flash_weight !== 'undefined') {
        value = entry.flash_weight;
      } else {
        entry.flash_weight = value;
      }
      min = Math.min(value, min);
      max = Math.max(value, max);
    }

    var candidateIndices = new Array();

    // TODO: This is not very efficient - the list can grow quite large
    for (var index = 0; index < app.wordList.length; index++) {
      let effectiveValue = app.wordList[index].flash_weight - min + 1;
      for (var i = 0; i < effectiveValue; i++) {
        candidateIndices.push(index);
      }
    }

    var entryIndex = Math.floor(Math.random() * candidateIndices.length);
    return candidateIndices[entryIndex];
  }

  function showFlashCard() {
    app.flashCardIndex = pickRandomCard();
    app.flashCard.querySelector(".word").innerText = app.wordList[app.flashCardIndex].word;
    app.flashCard.querySelector(".definition").innerText = app.wordList[app.flashCardIndex].definition;
    app.flashCard.querySelector(".definition").style.display = "none";
  }

  function renderUi(uiMode) {
    app.uiMode = uiMode;

    switch (app.uiMode) {
      case UIMode.LIST:
        app.fab.style.display = app.userId == null ? "none" : "block";
        app.wordsContainer.style.display = "block";
        app.userAccountCard.style.display = "none";
        app.flashCard.style.display = "none";
        break;

      case UIMode.FLASHCARDS:
        app.fab.style.display = "none";
        app.wordsContainer.style.display = "none";
        app.userAccountCard.style.display = "none";
        app.flashCard.style.display = "block";
        showFlashCard();
        break;

      case UIMode.ACCOUNT:
        app.fab.style.display = "none";
        app.wordsContainer.style.display = "none";
        app.flashCard.style.display = "none";
        app.userAccountCard.style.display = "block";
        break;
    }
  }

  function configureMaterial() {
    var drawer = mdc.drawer.MDCDrawer.attachTo(document.querySelector(".mdc-drawer"));

    var topAppBar = mdc.topAppBar.MDCTopAppBar.attachTo(app.topAppBarElement);
    topAppBar.setScrollTarget(app.mainContainer);
    topAppBar.listen('MDCTopAppBar:nav', () => {
      drawer.open = !drawer.open;
    });

    const listElement = document.querySelector('.mdc-drawer .mdc-list');

    listElement.addEventListener('click', (event) => {
      var targetElement = event.target || event.srcElement;
      var menuItem = targetElement.querySelector('.mdc-list-item__text').innerText;

      switch (menuItem) {
        case "List":
          renderUi(UIMode.LIST);
          break;
        case "Flashcards":
          renderUi(UIMode.FLASHCARDS);
          break;
        case "Account":
          renderUi(UIMode.ACCOUNT);
          break;
        default:
          console.log("ERROR: Unknown menu command");
          break;

      }

      drawer.open = false;
    });

    document.body.addEventListener('MDCDrawer:closed', () => {
      // app.mainContainer.querySelector('input, button').focus();
    });

    let addWordDialogElement = document.getElementById('add-word-dialog');
    app.addWordDialog = new mdc.dialog.MDCDialog(addWordDialogElement);
    app.addWordDialog.listen('MDCDialog:opened', () => {
      // Explanation: https://github.com/material-components/material-components-web/issues/4328
      const textField = new mdc.textField.MDCTextField(addWordDialogElement.querySelector(".mdc-dialog .mdc-text-field"));
      textField.layout();
    });

    app.addWordDialog.listen('MDCDialog:closed', (action) => {
      let definitionIndex = parseInt(action.detail.action);
      if (!Number.isNaN(definitionIndex)) {
        // TODO: check if the word exists
        app.firestore.collection("words/" + app.userId + "/entries").add({
          word: app.currentWord,
          definition: app.currentDefinitions[definitionIndex]
        });
      }
    });

    app.deleteWordDialog = new mdc.dialog.MDCDialog(document.getElementById('delete-word-dialog'));

    app.deleteWordDialog.listen('MDCDialog:closed', (action) => {
      if (action.detail.action == "yes") {
        app.firestore.collection("words/" + app.userId + "/entries").doc(app.wordToDelete).delete();
      }
      app.wordToDelete = null;
    });

    app.wordDetailDialog = new mdc.dialog.MDCDialog(document.getElementById('word-detail-dialog')); 
  }

  function configureEventListeners() {
    firebase.auth().onAuthStateChanged(function (user) {
      if (user) {
        //document.getElementById("headerTitle").innerText = "Welcome, " + user.displayName;
        document.getElementById("butAvatar").style.background = "url('" + user.photoURL + "') center center no-repeat";
        document.getElementById("butAvatar").style.backgroundSize = "contain";
        document.getElementById("butAvatar").style.display = "block";

        app.userAccountCard.querySelector(".name").innerText = user.displayName;
        app.userAccountCard.querySelector(".email").innerText = user.email;
        app.userId = user.uid;

        app.firestoreSnapshotListener = app.firestore.collection("words/" + user.uid + "/entries").onSnapshot((snapshot) => {

          snapshot.docChanges().forEach(function (change) {
            if (change.type === "added" || change.type === "modified") {
              var wordEntry = change.doc.data();
              wordEntry.id = change.doc.id;

              // Consider using https://github.com/gwtw/js-avl-tree for making it faster
              var i = 0;
              var updated = false;
              for (i = 0; i < app.wordList.length; i++) {
                if (wordEntry.word < app.wordList[i].word) {
                  let entryBefore = app.wordList[i];
                  app.wordList.splice(i, 0, wordEntry);
                  addWordCard(wordEntry, entryBefore);
                  updated = true;
                  break;
                } else if (wordEntry.word == app.wordList[i].word) {
                  app.wordList[i] = wordEntry;
                  addWordCard(wordEntry, null);
                  updated = true;
                  break;
                }
              }

              if (!updated) {
                app.wordList.push(wordEntry);
                addWordCard(wordEntry, null);
              }
            }
            else if (change.type === "removed") {
              var wordEntry = change.doc.data();
              let card = document.getElementById("word-" + wordEntry.word);
              card.parentNode.removeChild(card);
              for (var i = 0; i < app.wordList.length; i++) {
                if (app.wordList[i].word == wordEntry.word) {
                  break;
                }
              }
              app.wordList.splice(i, 1);
            }
          });

          if (app.processingFlashcardAction) {
            app.processingFlashcardAction = false;
          } else {
            renderUi(app.uiMode);
          }
        });
      } else {
        if (app.firestoreSnapshotListener != null) {
          app.firestoreSnapshotListener();
          app.firestoreSnapshotListener = null;
        }

        //document.getElementById("headerTitle").innerText = "Please sign in";
        document.getElementById("butAvatar").style.display = "none";

        // The start method will wait until the DOM is loaded.
        app.firebaseUi.start('#firebaseui-auth-container', app.firebaseUiConfig);

        app.wordsContainer.innerHTML = "";
      }
    });

    document.getElementById('butAvatar').addEventListener('click', function () {
      alert('Signing out...');
      firebase.auth().signOut().then(function () {
        app.userId = null;
        renderUi(UIMode.LIST);
        // Sign-out successful.
      }, function (error) {
        // An error happened.
      });
    });

    document.getElementById("add_word_ok_button").addEventListener('click', function () {
      app.currentWord = document.getElementById("word-text-field").value.trim().toLowerCase();
      document.getElementById("add_word_ok_button").disabled = true;

      app.addWordDialog.content_.innerHTML = "<img src='images/spinner.gif' alt='loading'>";
      app.addWordDialog.layout();

      lookupWordDefinitions(app.addWordDialog, app.currentWord);
    }); 

    app.flashCard.addEventListener('click', function() {
      var cardElement = app.flashCard.querySelector(".flip-card-inner");
      if (cardElement.classList.contains('is-flipped')) {
        showFlashCard();
      } else {
        cardElement.querySelector(".definition").style.display = "block";
      }
      cardElement.classList.toggle('is-flipped');      
    });

    app.fab.addEventListener('click', function() {
      const textFieldHtml = '<div class="mdc-text-field"><input type="text" id="word-text-field" class="mdc-text-field__input"><div class="mdc-line-ripple"></div></div>';
      app.addWordDialog.content_.innerHTML = textFieldHtml;
      document.getElementById("add_word_ok_button").disabled = false;
      const wordTextField = document.getElementById("word-text-field");
      
      wordTextField.value = "";
      app.addWordDialog.open();
    });

    document.getElementById("flash-card-less").addEventListener('click', function(event) {
      adjustFlashcardWeight(app.wordList[app.flashCardIndex], -1);
    });

    document.getElementById("flash-card-more").addEventListener('click', function(event) {
      adjustFlashcardWeight(app.wordList[app.flashCardIndex], 1);
    });
  }

  function adjustFlashcardWeight(entry, offset) {
    app.processingFlashcardAction = true;
    var value = 0;
    if (typeof entry.flash_weight !== 'undefined') {
        value = entry.flash_weight;
    }

    value += offset;
    app.firestore.collection("words/" + app.userId + "/entries").doc(entry.id).update({
      "flash_weight" : value
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('./service-worker.js')
        .then(function () { console.log('Service Worker Registered'); });
    }
  }

  function main() {
    firebase.initializeApp(app.firebaseConfig);
    configureMaterial();

    switch (window.location.hash) {
      case "#cards":
        app.uiMode = UIMode.FLASHCARDS;
        break;

      case "#account":
        app.uiMode = UIMode.ACCOUNT;
        break;

      default:
        app.uiMode = UIMode.LIST;
        break;
    }

    app.firebaseUi = new firebaseui.auth.AuthUI(firebase.auth());

    app.firestore = firebase.firestore();
    // TODO: Enable offline capabilities
    // https://pwafire.org/developer/codelabs/cloud-firestore-for-web/

    // Configures event listeners, including auth state changes.
    // Data gets loaded when the user is logged in.
    configureEventListeners();
    registerServiceWorker();
  }

  main();
})();
