/**
Add a pending transaction to the transaction list, after sending

@method addTransactionAfterSend
*/
addTransactionAfterSend = function(
  txHash,
  amount,
  from,
  to,
  smokePrice,
  estimatedSmoke,
  rawData,
  tokenId
) {
  var jsonInterface = undefined,
    contractName = undefined,
    data = undefined,
    txId = Helpers.makeId('tx', txHash);

  if (_.isObject(data)) {
    contractName = data.contract.name.replace(/([A-Z])/g, ' $1');
    jsonInterface = data.contract.jsonInterface;
    data = rawData.data;
  }

  Transactions.upsert(txId, {
    $set: {
      tokenId: tokenId,
      value: amount,
      from: from,
      to: to,
      timestamp: moment().unix(),
      transactionHash: txHash,
      smokePrice: smokePrice,
      smokeUsed: estimatedSmoke,
      fee: String(smokePrice * estimatedSmoke),
      data: data,
      jsonInterface: jsonInterface,
      contractName: contractName
    }
  });

  // add from Account
  FourtwentyAccounts.update(
    { address: from },
    {
      $addToSet: {
        transactions: txId
      }
    }
  );

  // add to Account
  FourtwentyAccounts.update(
    { address: to },
    {
      $addToSet: {
        transactions: txId
      }
    }
  );
};

/**
Add new in/outgoing transaction

@method addTransaction
@param {Object} log
@param {String} from
@param {String} to
@param {String} value
@return {Boolean} TRUE if a transaction already existed
*/
addTransaction = function(log, from, to, value) {
  var txId = Helpers.makeId('tx', log.transactionHash);

  // add the tx already here
  Transactions.upsert(txId, {
    to: to,
    from: from,
    value: value
  });

  var block = web3.fourtwenty.getBlock(log.blockNumber, false, function(err, block) {
    if (!err) {
      web3.fourtwenty.getTransaction(log.transactionHash, function(err, transaction) {
        if (!err && transaction) {
          web3.fourtwenty.getTransactionReceipt(log.transactionHash, function(
            err,
            receipt
          ) {
            delete transaction.hash;
            transaction.transactionHash = log.transactionHash;

            var tx = {
              _id: txId,
              timestamp: block.timestamp
            };

            if (log.tokenId) tx.tokenId = log.tokenId;

            if (log.returnValues && log.returnValues.operation)
              tx.operation = log.returnValues.operation;

            if (!err) {
              updateTransaction(tx, transaction, receipt);
            }
          });
        }
      });
    }
  });

  return Transactions.findOne(txId);
};

/**
Updates a transaction.

@method updateTransaction
@param {Object} newDocument     The transaction object from our database
@param {Object} transaction     The transaction object from getTransaction
@param {Object} receipt     The transaction object from getTransactionReceipt
@return {Object} The updated transaction
*/
var updateTransaction = function(newDocument, transaction, receipt) {
  var id =
    newDocument._id ||
    Helpers.makeId(
      'tx',
      transaction.transactionHash || newDocument.transactionHash
    );

  // if transaction has no transactionId, stop
  if (!id) return;

  var oldTx = Transactions.findOne({ _id: id });

  // if no tx was found, means it was never created, or removed, through log.removed: true
  if (!oldTx) return;

  newDocument._id = id;

  if (transaction) {
    newDocument.blockNumber = transaction.blockNumber;
    newDocument.blockHash = transaction.blockHash;
    newDocument.transactionIndex = transaction.transactionIndex;
    if (transaction.transactionHash)
      newDocument.transactionHash = transaction.transactionHash;

    newDocument.data = transaction.input || transaction.data || null;
    if (_.isString(newDocument.data) && newDocument.data === '0x')
      newDocument.data = null;

    newDocument.smokePrice = transaction.smokePrice.toString(10);
  }

  if (receipt && transaction) {
    // check for code on the address
    if (!newDocument.contractAddress && receipt.contractAddress) {
      web3.fourtwenty.getCode(receipt.contractAddress, function(e, code) {
        if (!e && code.length > 2) {
          Transactions.update(
            { _id: id },
            {
              $set: {
                deployedData: code
              }
            }
          );

          // Add contract to the contract list
          if (oldTx && oldTx.jsonInterface) {
            CustomContracts.upsert(
              { address: receipt.contractAddress },
              {
                $set: {
                  address: receipt.contractAddress,
                  name:
                    (oldTx.contractName || 'New Contract') +
                    ' ' +
                    receipt.contractAddress.substr(2, 4),
                  jsonInterface: oldTx.jsonInterface
                }
              }
            );

            //If it looks like a token, add it to the list
            var functionNames = _.pluck(oldTx.jsonInterface, 'name');
            var isToken =
              _.contains(functionNames, 'transfer') &&
              _.contains(functionNames, 'Transfer') &&
              _.contains(functionNames, 'balanceOf');
            console.log('isToken: ', isToken);

            if (isToken) {
              tokenId = Helpers.makeId('token', receipt.contractAddress);

              Tokens.upsert(tokenId, {
                $set: {
                  address: receipt.contractAddress,
                  name: oldTx.name + ' ' + receipt.contractAddress.substr(2, 4),
                  symbol: oldTx.name + receipt.contractAddress.substr(2, 4),
                  balances: {},
                  decimals: 0
                }
              });

              // check if the token has information about itself asynchrounously
              var tokenInstance = TokenContract;
              tokenInstance.options.address = receipt.contractAddress;

              tokenInstance.methods
                .name()
                .call()
                .then(function(name) {
                  Tokens.upsert(tokenId, {
                    $set: {
                      name: name
                    }
                  });
                  CustomContracts.upsert(
                    { address: receipt.contractAddress },
                    {
                      $set: {
                        name: TAPi18n.__('wallet.tokens.admin', { name: name })
                      }
                    }
                  );
                  return null;
                });

              tokenInstance.methods
                .decimals()
                .call()
                .then(function(decimals) {
                  Tokens.upsert(tokenId, {
                    $set: {
                      decimals: Number(decimals)
                    }
                  });
                  return null;
                });

              tokenInstance.methods
                .symbol()
                .call()
                .then(function(symbol) {
                  Tokens.upsert(tokenId, {
                    $set: {
                      symbol: symbol
                    }
                  });
                  return null;
                });
            }
          }
        }
      });
    }

    newDocument.contractAddress = receipt.contractAddress;
    newDocument.smokeUsed = receipt.smokeUsed;
    newDocument.smokeLimit = transaction.smoke;
    newDocument.outOfSmoke = receipt.smokeUsed === transaction.smoke;
    newDocument.fee = new BigNumber(transaction.smokePrice)
      .times(new BigNumber(receipt.smokeUsed))
      .toString(10);
  }

  if (oldTx) {
    // prevent wallet events overwriding token transfer events
    if (oldTx.tokenId && !newDocument.tokenId) {
      newDocument.tokenId = oldTx.tokenId;
      newDocument.from = oldTx.from;
      newDocument.to = oldTx.to;
      newDocument.value = oldTx.value;
    }

    delete newDocument._id;
    Transactions.update({ _id: id }, { $set: newDocument });
  }

  // check previous balance, vs current balance, if different remove the out of smoke
  if (newDocument.outOfSmoke) {
    var warningText = TAPi18n.__('wallet.transactions.error.outOfSmoke', {
      from: Helpers.getAccountNameByAddress(newDocument.from),
      to: Helpers.getAccountNameByAddress(newDocument.to)
    });

    if (FourtwentyAccounts.findOne({ address: newDocument.from })) {
      web3.fourtwenty.getBalance(newDocument.from, newDocument.blockNumber, function(
        e,
        now
      ) {
        if (!e) {
          web3.fourtwenty.getBalance(
            newDocument.from,
            newDocument.blockNumber - 1,
            function(e, then) {
              if (!e && now.toString(10) !== then.toString(10)) {
                console.log(
                  newDocument.transactionHash,
                  'Removed out of smoke, as balance changed'
                );
                Transactions.update({ _id: id }, { $set: { outOfSmoke: false } });
              } else {
                GlobalNotification.warning({
                  content: warningText,
                  duration: 10
                });
              }
            }
          );
        }
      });
    } else {
      GlobalNotification.warning({
        content: warningText,
        duration: 10
      });
    }
  }
};

/**
Observe transactions and pending confirmations

@method observeTransactions
*/
observeTransactions = function() {
  /**
    Checking for confirmations of transactions.

    @method checkTransactionConfirmations
    @param {Object} newDocument
    @param {Object} oldDocument
    */
  var checkTransactionConfirmations = function(tx) {
    var confCount = 0;

    // check for confirmations
    if (!tx.confirmed && tx.transactionHash) {
      var updateTransactions = function(e, blockHash) {
        console.log('updateTransactions', e, blockHash);

        if (!e) {
          var confirmations =
            tx.blockNumber && FourtwentyBlocks.latest.number
              ? FourtwentyBlocks.latest.number + 1 - tx.blockNumber
              : 0;
          confCount++;

          // get the latest tx data
          tx = Transactions.findOne(tx._id);

          // stop if tx was removed
          if (!tx) {
            subscription.unsubscribe();
            return;
          }

          if (
            confirmations < fourtwentyConfig.requiredConfirmations &&
            confirmations >= 0
          ) {
            Helpers.eventLogs(
              'Checking transaction ' +
                tx.transactionHash +
                '. Current confirmations: ' +
                confirmations
            );

            // Check if the tx still exists, if not disable the tx
            web3.fourtwenty.getTransaction(tx.transactionHash, function(
              e,
              transaction
            ) {
              web3.fourtwenty.getTransactionReceipt(tx.transactionHash, function(
                e,
                receipt
              ) {
                if (e || !receipt || !transaction) return;

                // update with receipt
                if (transaction.blockNumber !== tx.blockNumber)
                  updateTransaction(tx, transaction, receipt);
                else if (transaction.blockNumber && tx.disabled)
                  // enable transaction, if it was disabled
                  Transactions.update(tx._id, {
                    $unset: {
                      disabled: ''
                    }
                  });
                else if (!transaction.blockNumber) {
                  // disable transaction if gone (wait for it to come back)
                  Transactions.update(tx._id, {
                    $set: {
                      disabled: true
                    }
                  });
                }
              });
            });
          }

          if (
            confirmations > fourtwentyConfig.requiredConfirmations ||
            confCount > fourtwentyConfig.requiredConfirmations * 2
          ) {
            // confirm after a last check
            web3.fourtwenty.getTransaction(tx.transactionHash, function(
              e,
              transaction
            ) {
              web3.fourtwenty.getTransactionReceipt(tx.transactionHash, function(
                e,
                receipt
              ) {
                if (!e) {
                  // if still not mined, remove tx
                  if (!transaction || !transaction.blockNumber) {
                    var warningText = TAPi18n.__(
                      'wallet.transactions.error.outOfSmoke',
                      {
                        from: Helpers.getAccountNameByAddress(tx.from),
                        to: Helpers.getAccountNameByAddress(tx.to)
                      }
                    );
                    Helpers.eventLogs(warningText);
                    GlobalNotification.warning({
                      content: warningText,
                      duration: 10
                    });

                    Transactions.remove(tx._id);
                    subscription.unsubscribe();
                  } else if (transaction.blockNumber) {
                    // check if parent block changed
                    // TODO remove if later tx.blockNumber can be null again
                    web3.fourtwenty.getBlock(transaction.blockNumber, function(
                      e,
                      block
                    ) {
                      if (!e) {
                        if (block.hash === transaction.blockHash) {
                          tx.confirmed = true;
                          updateTransaction(tx, transaction, receipt);

                          // remove disabled
                          if (tx.disabled)
                            Transactions.update(tx._id, {
                              $unset: {
                                disabled: ''
                              }
                            });

                          // remove if the parent block is not in the chain anymore.
                        } else {
                          Transactions.remove(tx._id);
                        }

                        subscription.unsubscribe();
                      }
                    });
                  }
                }
              });
            });
          }
        }
      };

      var subscription = web3.fourtwenty.subscribe('newBlockHeaders', function(
        error,
        result
      ) {
        updateTransactions(error, result ? result.hash : null);
      });
    }
  };

  /**
    Observe transactions, listen for new created transactions.

    @class Transactions({}).observe
    @constructor
    */
  collectionObservers[collectionObservers.length] = Transactions.find(
    {}
  ).observe({
    /**
      This will observe the transactions creation and
      create watchers for outgoing transactions,
      to see when they are mined.

      @method added
    */
    added: function(newDocument) {
      var confirmations = FourtwentyBlocks.latest.number - newDocument.blockNumber;

      // add to accounts
      Wallets.update(
        { address: newDocument.from },
        {
          $addToSet: {
            transactions: newDocument._id
          }
        }
      );
      Wallets.update(
        { address: newDocument.to },
        {
          $addToSet: {
            transactions: newDocument._id
          }
        }
      );

      // remove pending confirmations, if present
      if (newDocument.operation) {
        checkConfirmation(Helpers.makeId('pc', newDocument.operation));
      }

      // check first if the transaction was already mined
      if (!newDocument.confirmed) {
        checkTransactionConfirmations(newDocument);
      }

      // If on main net, add price data
      if (
        Session.get('network') == 'main' &&
        newDocument.timestamp &&
        (!newDocument.exchangeRates ||
          !newDocument.exchangeRates.btc ||
          !newDocument.exchangeRates.usd ||
          !newDocument.exchangeRates.eur ||
          !newDocument.exchangeRates.gbp ||
          !newDocument.exchangeRates.brl)
      ) {
        var url =
          'https://min-api.cryptocompare.com/data/pricehistorical?fsym=420&tsyms=BTC,USD,EUR,GBP,BRL&ts=' +
          newDocument.timestamp;

        if (typeof haze !== 'undefined')
          url += '&extraParams=Haze-' + haze.version;

        HTTP.get(url, function(e, res) {
          if (!e && res && res.statusCode === 200) {
            var content = JSON.parse(res.content);

            if (content && content.Response !== 'Error') {
              _.each(content, function(price, key) {
                if (price && _.isFinite(price)) {
                  var name = key.toLowerCase();
                  var set = {};
                  set['exchangeRates.' + name] = {
                    price: String(price),
                    timestamp: null
                  };

                  Transactions.update(newDocument._id, { $set: set });
                }
              });
            }
          } else {
            console.warn(
              'Cannot connect to https://min-api.cryptocompare.com/ to get price ticker data, please check your internet connection.'
            );
          }
        });
      }
    },
    /**
      Will check if the transaction is confirmed

      @method changed
    */
    changed: function(newDocument) {
      // add to accounts
      Wallets.update(
        { address: newDocument.from },
        {
          $addToSet: {
            transactions: newDocument._id
          }
        }
      );
      Wallets.update(
        { address: newDocument.to },
        {
          $addToSet: {
            transactions: newDocument._id
          }
        }
      );

      // remove pending confirmations, if present
      if (newDocument.operation) {
        checkConfirmation(Helpers.makeId('pc', newDocument.operation));
      }
    },
    /**
      Remove transactions confirmations from the accounts

      @method removed
    */
    removed: function(document) {
      Wallets.update(
        { address: document.from },
        {
          $pull: {
            transactions: document._id
          }
        }
      );
      Wallets.update(
        { address: document.to },
        {
          $pull: {
            transactions: document._id
          }
        }
      );
      FourtwentyAccounts.update(
        { address: document.from },
        {
          $pull: {
            transactions: document._id
          }
        }
      );
      FourtwentyAccounts.update(
        { address: document.to },
        {
          $pull: {
            transactions: document._id
          }
        }
      );
    }
  });
};
