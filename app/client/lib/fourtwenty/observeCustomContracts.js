/**
Observe custom contacts

@method observeCustomContracts
*/
observeCustomContracts = function() {
  /**
    Observe custom contracts, listen for new created tokens.

    @class CustomContracts({}).observe
    @constructor
    */
  collectionObservers[collectionObservers.length] = CustomContracts.find(
    {}
  ).observe({
    /**
      Will check if the contracts are on the current chain

      @method added
    */
    added: function(newDocument) {
      // check if wallet has code
      web3.fourtwenty.getCode(newDocument.address, function(e, code) {
        if (!e && code && code.length > 2) {
          CustomContracts.update(newDocument._id, {
            $unset: {
              disabled: false
            }
          });

          // TODO: check for logs
          // addLogWatching(newDocument);
        } else if (!e) {
          // if there's no code, check the contract has a balance
          web3.fourtwenty.getBalance(newDocument.address, function(e, balance) {
            if (!e && web3.utils.toBN(balance).gt(0)) {
              CustomContracts.update(newDocument._id, {
                $unset: {
                  disabled: false
                }
              });

              // TODO: check for logs
              // addLogWatching(newDocument);
            } else if (!e) {
              CustomContracts.update(newDocument._id, {
                $set: {
                  disabled: true
                }
              });
            }
          });
        }
      });
    }
  });
};

// TODO: convert from filters to subscriptions
// var addLogWatching = function(newDocument){
//     var contractInstance = new web3.fourtwenty.Contract(newDocument.jsonInterface, newDocument.address);
//     var blockToCheckBack = (newDocument.checkpointBlock || 0) - fourtwentyConfig.rollBackBy;
//     if(blockToCheckBack < 0)
//         blockToCheckBack = 0;
//     console.log('EVENT LOG:  Checking Custom Contract Events for '+ newDocument.address +' (_id: '+ newDocument._id + ') from block # '+ blockToCheckBack);
//     // delete the last logs until block -500
//     _.each(Events.find({_id: {$in: newDocument.contractEvents || []}, blockNumber: {$exists: true, $gt: blockToCheckBack}}).fetch(), function(log){
//         if(log)
//             Events.remove({_id: log._id});
//     });
//     var filter = contractInstance.allEvents({fromBlock: blockToCheckBack, toBlock: 'latest'});
//     // get past logs, to set the new blockNumber
//     var currentBlock = FourtwentyBlocks.latest.number;
//     filter.get(function(error, logs) {
//         if(!error) {
//             // update last checkpoint block
//             CustomContracts.update({_id: newDocument._id}, {$set: {
//                 checkpointBlock: (currentBlock || FourtwentyBlocks.latest.number) - fourtwentyConfig.rollBackBy
//             }});
//         }
//     });
//     filter.watch(function(error, log){
//         if(!error) {
//             var id = Helpers.makeId('log', web3.sha3(log.logIndex + 'x' + log.transactionHash + 'x' + log.blockHash));
//             if(log.removed) {
//                 Events.remove(id);
//             } else {
//                 web3.fourtwenty.getBlock(log.blockHash, function(err, block){
//                     if(!err) {
//                         _.each(log.args, function(value, key){
//                             // if bignumber
//                             if((_.isObject(value) || value instanceof BigNumber) && value.toFormat) {
//                                 value = value.toString(10);
//                                 log.args[key] = value;
//                             }
//                         });
//                         log.timestamp = block.timestamp;
//                         Events.upsert(id, log);
//                     }
//                 });
//             }
//         }
//     });
// };
