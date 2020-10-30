/**
Template Controllers

@module Templates
*/

/**
The send transaction info template

@class [template] views_modals_sendTransactionInfo
@constructor
*/

// Set basic variables
Template['views_modals_sendTransactionInfo'].helpers({
  /**
    Calculates the fee used for this transaction in 420coin

    @method (estimatedFee)
    */
  estimatedFee: function() {
    if (this.estimatedSmoke && this.smokePrice)
      return FourtwentyTools.formatBalance(
        new BigNumber(this.estimatedSmoke, 10).times(
          new BigNumber(this.smokePrice, 10)
        ),
        '0,0.0[0000000] unit',
        '420coin'
      );
  }
});
