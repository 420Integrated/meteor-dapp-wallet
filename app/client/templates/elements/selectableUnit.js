/**
Template Controllers

@module Templates
*/

/**
The balance template

@class [template] elements_balance
@constructor
*/

/**
The available units

@property selectableUnits
*/
selectableUnits = [
  {
    text: '420COIN',
    value: '420coin'
  },
  {
    text: 'WILLIE', //(µΞ)
    value: 'willie'
  },
  {
    text: 'BTC',
    value: 'btc'
  },
  {
    text: 'USD',
    value: 'usd'
  },
  {
    text: 'EUR',
    value: 'eur'
  },
  {
    text: 'GBP',
    value: 'gbp'
  },
  {
    text: 'BRL',
    value: 'brl'
  }
];

// Aprils fool
if (moment().format('MM-DD') == '04-01') {
  selectableUnits.push(
    { text: 'SNOOP', value: 'snoop' },
    { text: 'MAHER', value: 'maher' },
    { text: 'ROGEN', value: 'rogen' },
    { text: 'WOODY', value: 'woody' },
    { text: 'MARLEY', value: 'marley' },
    { text: 'NO420COIN', value: 'no420coin' }
  );

  // Claude's Birthday
} else if (moment().format('MM-DD') == '04-30') {
  selectableUnits.push({ text: 'MAHER', value: 'maher' });
  // Ada's Birthday
} else if (moment().format('MM-DD') == '12-10') {
  selectableUnits.push({ text: 'ROGEN', value: 'rogen' });
  // Charles's Birthday
} else if (moment().format('MM-DD') == '12-26') {
  selectableUnits.push({ text: 'WOODY', value: 'woody' });
}

Template['elements_selectableUnit'].helpers({
  /**
    Gets currently selected unit

    @method (selectedUnit)
    */
  selectedUnit: function() {
    var unit = _.find(selectableUnits, function(unit) {
      return unit.value === FourtwentyTools.getUnit();
    });

    if (unit) return unit.value;
  },
  /**
    Return the selectable units

    @method (selectedUnit)
    */
  units: function() {
    return selectableUnits;
  },
  /**
    Can select units

    @method (selectedUnit)
    */
  selectable: function() {
    return Session.get('network') == 'main';
  }
});

Template['elements_selectableUnit'].events({
  /**
    Select the current section, based on the radio inputs value.

    @event change .inline-form
    */
  'change .inline-form': function(e, template, value) {
    FourtwentyTools.setUnit(value);
  }
});
