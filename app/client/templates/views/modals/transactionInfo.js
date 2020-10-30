/**
Template Controllers

@module Templates
*/

/**
The transaction info template

@class [template] views_modals_transactionInfo
@constructor
*/

Template['views_modals_transactionInfo'].helpers({
  /**
    Returns the current transaction

    @method (transaction)
    @return {Object} the current transaction
    */
  transaction: function() {
    return Transactions.findOne(this._id);
  },
  /**
    Calculates the confirmations of this tx

    @method (confirmations)
    @return {Number} the number of confirmations
    */
  confirmations: function() {
    return FourtwentyBlocks.latest && this.blockNumber
      ? FourtwentyBlocks.latest.number + 1 - this.blockNumber
      : 0;
  },
  /**
    Token value

    @method (tokenValue)
    */
  tokenValue: function() {
    var token = Tokens.findOne(this.tokenId);

    return token
      ? Helpers.formatNumberByDecimals(this.value, token.decimals) +
          ' ' +
          token.symbol
      : this.value;
  },
  /**
    Smoke Price per million

    @method (smokePricePerMillion)
    */
  smokePricePerMillion: function() {
    return this.smokePrice * 1000000;
  }
});